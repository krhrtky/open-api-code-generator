#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { OpenAPICodeGenerator } from './generator';
import { I18nService } from './i18n';
import * as fs from 'fs-extra';
import * as path from 'path';

interface CLIOptions {
  input: string;
  output?: string;
  package?: string;
  lang?: string;
  controllers?: boolean;
  models?: boolean;
  validation?: boolean;
  swagger?: boolean;
  verbose?: boolean;
}

async function main() {
  const i18n = new I18nService();
  await i18n.initialize();

  const program = new Command();
  
  program
    .name('openapi-codegen')
    .description('OpenAPI Code Generator - TypeScript Implementation with full i18n support')
    .version('1.0.0');

  program
    .requiredOption('-i, --input <file>', 'OpenAPI specification file path')
    .option('-o, --output <dir>', 'Output directory', './generated')
    .option('-p, --package <name>', 'Base package name', 'com.example.api')
    .option('-l, --lang <code>', 'Language code (auto-detect if not specified)')
    .option('--controllers', 'Generate controllers (default: true)')
    .option('--no-controllers', 'Disable controller generation')
    .option('--models', 'Generate models (default: true)')
    .option('--no-models', 'Disable model generation')
    .option('--validation', 'Generate validation annotations (default: true)')
    .option('--no-validation', 'Disable validation annotations')
    .option('--swagger', 'Generate Swagger annotations (default: true)')
    .option('--no-swagger', 'Disable Swagger annotations')
    .option('-v, --verbose', 'Verbose output', false);

  program.action(async (options: CLIOptions) => {
    try {
      // Set language if specified
      if (options.lang) {
        await i18n.setLanguage(options.lang);
      }

      // Validate input file
      if (!await fs.pathExists(options.input)) {
        console.error(chalk.red('❌ ' + i18n.t('cli.errors.fileNotFound', { file: options.input })));
        process.exit(1);
      }

      // Check file format
      const ext = path.extname(options.input).toLowerCase();
      if (!['.yaml', '.yml', '.json'].includes(ext)) {
        console.error(chalk.red('❌ ' + i18n.t('cli.errors.unsupportedFormat', { format: ext })));
        process.exit(1);
      }

      // Initialize generator
      const generator = new OpenAPICodeGenerator({
        outputDir: path.resolve(options.output!),
        basePackage: options.package!,
        generateControllers: options.controllers !== false,
        generateModels: options.models !== false,
        includeValidation: options.validation !== false,
        includeSwagger: options.swagger !== false,
        verbose: options.verbose || false,
        i18n: i18n
      });

      // Generate code
      const result = await generator.generate(options.input);

      // Success message
      console.log(chalk.green(i18n.t('cli.completed')));
      console.log(chalk.blue(i18n.t('cli.outputDir', { path: result.outputDir })));
      console.log(chalk.blue(i18n.t('cli.fileCount', { count: result.fileCount })));
      
      if (!options.verbose) {
        console.log(chalk.gray(i18n.t('cli.verboseHint')));
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('❌ Error: ' + errorMessage));
      process.exit(1);
    }
  });

  program.parse();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('❌ Unexpected error:'), error);
    process.exit(1);
  });
}

export { main };