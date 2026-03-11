import * as fs from 'fs';
import * as path from 'node:path';
import { Code } from 'aws-cdk-lib/aws-lambda';
import type { FunctionBuildResult } from '../components/lambda/lambda-types';
import { IacErrors } from '../errors';

/** Path under shared dir that Lambda expects for Python (extracts to /opt/python). */
const SHARED_PYTHON_DIR = 'python';

/**
 * Lambda builder: path validation and function code asset creation.
 * Mirrors Ad-Results pattern (lib/helpers/lambda-builder.ts).
 */
export class LambdaBuilder {
  /**
   * Validate that functions path and build directory exist or can be created.
   */
  static validatePaths(functionsPath: string, buildDirectory: string): void {
    if (!fs.existsSync(functionsPath)) {
      throw IacErrors.lambda(
        `Functions path not found: ${functionsPath}. Check stack.lambda.functionsPath in config.`,
        'validatePaths'
      );
    }
    try {
      if (!fs.existsSync(buildDirectory)) {
        fs.mkdirSync(buildDirectory, { recursive: true });
      }
    } catch (error) {
      throw IacErrors.lambda(
        `Failed to create build directory: ${buildDirectory}`,
        'validatePaths',
        error
      );
    }
  }

  /**
   * Validate that a function folder exists and has handler.py and __init__.py.
   */
  static validateFunctionFolder(functionsPath: string, functionName: string): void {
    const functionDirPath = path.join(functionsPath, functionName);
    if (!fs.existsSync(functionDirPath)) {
      throw IacErrors.lambda(
        `Lambda function folder not found: ${functionName} in ${functionsPath}`,
        'validateFunctionFolder'
      );
    }
    const stat = fs.statSync(functionDirPath);
    if (!stat.isDirectory()) {
      throw IacErrors.lambda(
        `Lambda function path is not a directory: ${functionName}`,
        'validateFunctionFolder'
      );
    }
    const handlerPath = path.join(functionDirPath, 'handler.py');
    if (!fs.existsSync(handlerPath)) {
      throw IacErrors.lambda(
        `Missing handler.py in Lambda folder: ${functionName}`,
        'validateFunctionFolder'
      );
    }
    const initPath = path.join(functionDirPath, '__init__.py');
    if (!fs.existsSync(initPath)) {
      throw IacErrors.lambda(
        `Missing __init__.py in Lambda folder: ${functionName}`,
        'validateFunctionFolder'
      );
    }
  }

  /**
   * Create Lambda function code asset from a *_lambda folder.
   * Uses the folder as-is (no copy to build dir) for simplicity; CDK will hash it.
   */
  static createFunctionCode(functionsPath: string, functionName: string): FunctionBuildResult {
    const functionDirPath = path.join(functionsPath, functionName);
    LambdaBuilder.validateFunctionFolder(functionsPath, functionName);
    return {
      code: Code.fromAsset(functionDirPath),
      exists: true,
    };
  }

  /**
   * Create Lambda layer code asset from the shared folder (lambda/shared).
   * Expects shared/python/ so that in Lambda it extracts to /opt/python and
   * imports like `from common import ...` work.
   */
  static createSharedLayerCode(sharedPath: string): FunctionBuildResult {
    const pythonDir = path.join(sharedPath, SHARED_PYTHON_DIR);
    if (!fs.existsSync(pythonDir) || !fs.statSync(pythonDir).isDirectory()) {
      throw IacErrors.lambda(
        `Shared layer path not found or missing python/: ${pythonDir}. Expected: lambda/shared/python/`,
        'createSharedLayerCode'
      );
    }
    return {
      code: Code.fromAsset(sharedPath),
      exists: true,
    };
  }
}
