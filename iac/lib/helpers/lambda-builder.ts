import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Code } from 'aws-cdk-lib/aws-lambda';
import {
  DotfilePrefix,
  LambdaAssetPayload,
  LambdaArtifactFile,
  LambdaBuild,
  LambdaBuildDirectoryName,
  LambdaBuilderMessage,
  LambdaBuilderOperation,
  LambdaSharedLayout,
} from '../../constants';
import type { FunctionBuildResult } from '../components/lambda/lambda-types';
import { IacErrors } from '../errors';

export class LambdaBuilder {
  static calculateDirectoryHash(dirPath: string): string {
    if (!fs.existsSync(dirPath)) {
      throw IacErrors.lambda(
        LambdaBuilderMessage.directoryNotFound(dirPath),
        LambdaBuilderOperation.CalculateDirectoryHash
      );
    }
    const hash = createHash(LambdaBuild.ContentHashAlgorithm);
    const files = LambdaBuilder.getAllFiles(dirPath).sort((a, b) => a.localeCompare(b));
    for (const file of files) {
      const relativePath = path.relative(dirPath, file);
      const content = fs.readFileSync(file);
      hash.update(`${relativePath}${LambdaBuild.ContentHashEntrySeparator}${content}`);
    }
    return hash.digest('hex').substring(0, LambdaBuild.ContentHashHexLength);
  }

  private static getAllFiles(dirPath: string): string[] {
    const files: string[] = [];
    const traverse = (currentPath: string): void => {
      const items = fs.readdirSync(currentPath);
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (stat.isFile() && !item.startsWith(DotfilePrefix)) {
          files.push(fullPath);
        }
      }
    };
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

  static validatePaths(functionsPath: string, buildDirectory: string): void {
    if (!fs.existsSync(functionsPath)) {
      throw IacErrors.lambda(
        LambdaBuilderMessage.functionsPathNotFound(functionsPath),
        LambdaBuilderOperation.ValidatePaths
      );
    }
    try {
      if (!fs.existsSync(buildDirectory)) {
        fs.mkdirSync(buildDirectory, { recursive: true });
      }
    } catch (error) {
      throw IacErrors.lambda(
        LambdaBuilderMessage.buildDirectoryCreateFailed(buildDirectory),
        LambdaBuilderOperation.ValidatePaths,
        error
      );
    }
  }

  static validateFunctionFolder(functionsPath: string, functionName: string): void {
    const functionDirPath = path.join(functionsPath, functionName);
    if (!fs.existsSync(functionDirPath)) {
      throw IacErrors.lambda(
        LambdaBuilderMessage.functionFolderNotFound(functionName, functionsPath),
        LambdaBuilderOperation.ValidateFunctionFolder
      );
    }
    const stat = fs.statSync(functionDirPath);
    if (!stat.isDirectory()) {
      throw IacErrors.lambda(
        LambdaBuilderMessage.functionPathNotDirectory(functionName),
        LambdaBuilderOperation.ValidateFunctionFolder
      );
    }
    const handlerPath = path.join(functionDirPath, LambdaArtifactFile.Handler);
    if (!fs.existsSync(handlerPath)) {
      throw IacErrors.lambda(
        LambdaBuilderMessage.missingHandler(functionName),
        LambdaBuilderOperation.ValidateFunctionFolder
      );
    }
    const initPath = path.join(functionDirPath, LambdaArtifactFile.Init);
    if (!fs.existsSync(initPath)) {
      throw IacErrors.lambda(
        LambdaBuilderMessage.missingInit(functionName),
        LambdaBuilderOperation.ValidateFunctionFolder
      );
    }
  }

  static createFunctionCode(functionsPath: string, functionName: string): FunctionBuildResult {
    const functionDirPath = path.join(functionsPath, functionName);
    LambdaBuilder.validateFunctionFolder(functionsPath, functionName);
    return {
      code: Code.fromAsset(functionDirPath),
      exists: LambdaAssetPayload.Exists,
    };
  }

  static createSharedLayerCode(sharedPath: string, buildDirectory: string): FunctionBuildResult {
    const pythonDir = path.join(sharedPath, LambdaSharedLayout.PythonSubdir);
    if (!fs.existsSync(pythonDir) || !fs.statSync(pythonDir).isDirectory()) {
      throw IacErrors.lambda(
        LambdaBuilderMessage.sharedLayerInvalid(pythonDir),
        LambdaBuilderOperation.CreateSharedLayerCode
      );
    }

    const contentHash = LambdaBuilder.calculateDirectoryHash(sharedPath);
    const layerBuildDir = path.join(buildDirectory, LambdaBuildDirectoryName.LayerBuilds);
    const buildDir = path.join(layerBuildDir, `${LambdaBuild.LayerOutputDirPrefix}${contentHash}`);

    fs.mkdirSync(buildDir, { recursive: true });
    LambdaBuilder.copyDirectory(sharedPath, buildDir);

    setTimeout(() => {
      try {
        if (fs.existsSync(buildDir)) LambdaBuilder.removeDirectory(buildDir);
      } catch {
        /* best-effort temp cleanup */
      }
    }, LambdaBuild.CleanupDelayMs);

    return {
      code: Code.fromAsset(buildDir),
      exists: LambdaAssetPayload.Exists,
    };
  }
}
