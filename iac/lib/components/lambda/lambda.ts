import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Function as LambdaFunction, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import {
  ConstructId,
  LambdaComponentMessage,
  LambdaComponentOperation,
  LambdaLayer,
  lambdaRuntimeBundle,
} from '../../../constants';
import type { Config } from '../../config/config';
import { getResourceName } from '../../config/global-config';
import { LambdaBuilder } from '../../helpers/lambda-builder';
import { IacErrors } from '../../errors';
import type { BuiltLambdaFunction, LambdaProps } from './lambda-types';

export class Lambda extends Construct {
  readonly functions: BuiltLambdaFunction[] = [];
  private readonly config: Config;
  private readonly resolvedFunctionsPath: string;

  constructor(
    scope: Construct,
    id: string,
    props: LambdaProps & {
      readonly resolvedFunctionsPath: string;
      readonly resolvedSharedPath: string;
      readonly resolvedBuildDir: string;
    }
  ) {
    super(scope, id);
    this.config = props.config;
    this.resolvedFunctionsPath = props.resolvedFunctionsPath;

    const lambdaConfig = this.config.stack.lambda;
    LambdaBuilder.validatePaths(this.resolvedFunctionsPath, lambdaConfig.buildDirectory);

    const layerResult = LambdaBuilder.createSharedLayerCode(
      props.resolvedSharedPath,
      props.resolvedBuildDir
    );
    const sharedLayer = new LayerVersion(this, ConstructId.SharedLayer, {
      code: layerResult.code,
      description: LambdaLayer.Description,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const roleMap = props.roleMap;
    const toCreate = lambdaConfig.functions.filter((f) => f.enabled !== false);
    for (const functionConfig of toCreate) {
      LambdaBuilder.validateFunctionFolder(this.resolvedFunctionsPath, functionConfig.name);
      const buildResult = LambdaBuilder.createFunctionCode(
        this.resolvedFunctionsPath,
        functionConfig.name
      );
      const resourceName = getResourceName(functionConfig.name, this.config);
      const customRole =
        functionConfig.role && roleMap ? roleMap.get(functionConfig.role) : undefined;

      const fn = new LambdaFunction(this, functionConfig.name, {
        functionName: resourceName,
        runtime: lambdaRuntimeBundle.runtime,
        architecture: lambdaRuntimeBundle.architecture,
        handler: lambdaRuntimeBundle.handler,
        code: buildResult.code,
        timeout: Duration.seconds(functionConfig.timeout ?? lambdaConfig.defaultTimeout),
        memorySize: functionConfig.memorySize ?? lambdaConfig.defaultMemorySize,
        ...(customRole ? { role: customRole } : {}),
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
      throw IacErrors.lambda(
        LambdaComponentMessage.functionNotFound(functionName),
        LambdaComponentOperation.GetLambdaFunction
      );
    }
    return child as LambdaFunction;
  }
}
