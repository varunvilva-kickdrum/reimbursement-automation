import { Duration } from 'aws-cdk-lib';
import { Function as LambdaFunction, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { lambdaConstants } from '../../constants/lambda-constants';
import { getResourceName } from '../../config/global-config';
import { LambdaBuilder } from '../../helpers/lambda-builder';
import type { Config } from '../../config/config';
import type { LambdaProps, BuiltLambdaFunction } from './lambda-types';

/**
 * Lambda component: creates Lambda functions from config (one per *_lambda folder).
 * Attaches a shared layer (lambda/shared) so all functions can use common code.
 */
export class Lambda extends Construct {
  readonly functions: BuiltLambdaFunction[] = [];
  private readonly config: Config;
  private readonly resolvedFunctionsPath: string;

  constructor(
    scope: Construct,
    id: string,
    props: LambdaProps & { resolvedFunctionsPath: string; resolvedSharedPath: string }
  ) {
    super(scope, id);
    this.config = props.config;
    this.resolvedFunctionsPath = props.resolvedFunctionsPath;

    const lambdaConfig = this.config.stack.lambda;
    LambdaBuilder.validatePaths(this.resolvedFunctionsPath, lambdaConfig.buildDirectory);

    const layerResult = LambdaBuilder.createSharedLayerCode(props.resolvedSharedPath);
    const sharedLayer = new LayerVersion(this, 'SharedLayer', {
      code: layerResult.code,
      description: 'Shared Python code for all Lambdas',
    });

    const toCreate = lambdaConfig.functions.filter((f) => f.enabled !== false);
    for (const functionConfig of toCreate) {
      LambdaBuilder.validateFunctionFolder(this.resolvedFunctionsPath, functionConfig.name);
      const buildResult = LambdaBuilder.createFunctionCode(
        this.resolvedFunctionsPath,
        functionConfig.name
      );
      const resourceName = getResourceName(functionConfig.name, this.config);
      const fn = new LambdaFunction(this, functionConfig.name, {
        functionName: resourceName,
        runtime: lambdaConstants.DEFAULT_RUNTIME,
        architecture: lambdaConstants.DEFAULT_ARCHITECTURE,
        handler: lambdaConstants.DEFAULT_HANDLER,
        code: buildResult.code,
        timeout: Duration.seconds(functionConfig.timeout ?? lambdaConfig.defaultTimeout),
        memorySize: functionConfig.memorySize ?? lambdaConfig.defaultMemorySize,
      });
      fn.addLayers(sharedLayer);
      this.functions.push({
        name: functionConfig.name,
        resourceName,
        functionArn: fn.functionArn,
      });
    }
  }

  getLambdaFunction(functionName: string): LambdaFunction {
    const child = this.node.tryFindChild(functionName);
    if (!child) {
      throw new Error(`Lambda function not found: ${functionName}`);
    }
    return child as LambdaFunction;
  }
}
