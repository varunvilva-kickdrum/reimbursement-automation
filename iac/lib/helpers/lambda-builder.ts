import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Code } from 'aws-cdk-lib/aws-lambda';
import { lambdaConstants } from '../constants/lambda-constants';
import type { FunctionBuildResult } from '../components/lambda/lambda-types';
import { IacErrors } from '../errors';

/** Path under shared dir that Lambda expects for Python (extracts to /opt/python). */
const SHARED_PYTHON_DIR = 'python';

/**
 * Lambda builder: path validation and function code asset creation.
 * Shared layer uses content hash so a new layer is only published when shared folder changes (Ad-Results pattern).
 */
export class LambdaBuilder {
  /**
   * Calculate content hash for a directory (file paths + contents).
   * Same content → same hash → same asset path → no new layer version.
   */
  static calculateDirectoryHash(dirPath: string): string {
    if (!fs.existsSync(dirPath)) {
      throw IacErrors.lambda(`Directory not found: ${dirPath}`, 'calculateDirectoryHash');
    }
    const hash = createHash('sha256');
    const files = LambdaBuilder.getAllFiles(dirPath).sort((a, b) => a.localeCompare(b));
    for (const file of files) {
      const relativePath = path.relative(dirPath, file);
      const content = fs.readFileSync(file);
      hash.update(`${relativePath}:${content}`);
    }
    return hash.digest('hex').substring(0, 8);
  }

  private static getAllFiles(dirPath: string): string[] {
    const files: string[] = [];
    function traverse(currentPath: string) {
      const items = fs.readdirSync(currentPath);
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (stat.isFile() && !item.startsWith('.')) {
          files.push(fullPath);
        }
      }
    }
    traverse(dirPath);
    return files;
  }

  private static copyDirectory(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    const items = fs.readdirSync(src);
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        LambdaBuilder.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private static removeDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) return;
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      if (fs.statSync(fullPath).isDirectory()) {
        LambdaBuilder.removeDirectory(fullPath);
      } else {
        fs.unlinkSync(fullPath);
      }
    }
    fs.rmdirSync(dirPath);
  }

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
   * Builds into a content-hash–named directory so a new layer version is only published
   * when the shared folder contents change; otherwise the same asset path is reused.
   * Expects shared/python/ so that in Lambda it extracts to /opt/python.
   */
  static createSharedLayerCode(sharedPath: string, buildDirectory: string): FunctionBuildResult {
    const pythonDir = path.join(sharedPath, SHARED_PYTHON_DIR);
    if (!fs.existsSync(pythonDir) || !fs.statSync(pythonDir).isDirectory()) {
      throw IacErrors.lambda(
        `Shared layer path not found or missing python/: ${pythonDir}. Expected: lambda/shared/python/`,
        'createSharedLayerCode'
      );
    }

    const contentHash = LambdaBuilder.calculateDirectoryHash(sharedPath);
    const layerBuildDir = path.join(buildDirectory, lambdaConstants.BUILD_DIRS.LAYER_BUILD);
    const buildDir = path.join(layerBuildDir, `shared-layer-${contentHash}`);

    fs.mkdirSync(buildDir, { recursive: true });
    LambdaBuilder.copyDirectory(sharedPath, buildDir);

    // Optional: clean build dir after CDK has read it (same pattern as Ad-Results)
    setTimeout(() => {
      try {
        if (fs.existsSync(buildDir)) LambdaBuilder.removeDirectory(buildDir);
      } catch {
        // Ignore cleanup failures
      }
    }, 5000);

    return {
      code: Code.fromAsset(buildDir),
      exists: true,
    };
  }
}
