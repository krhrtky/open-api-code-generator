#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const generator_1 = require("./generator");
const i18n_1 = require("./i18n");
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
async function main() {
    const i18n = new i18n_1.I18nService();
    await i18n.initialize();
    const program = new commander_1.Command();
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
    program.action(async (options) => {
        try {
            // Set language if specified
            if (options.lang) {
                await i18n.setLanguage(options.lang);
            }
            // Validate input file
            if (!await fs.pathExists(options.input)) {
                console.error(chalk_1.default.red('❌ ' + i18n.t('cli.errors.fileNotFound', { file: options.input })));
                process.exit(1);
            }
            // Check file format
            const ext = path.extname(options.input).toLowerCase();
            if (!['.yaml', '.yml', '.json'].includes(ext)) {
                console.error(chalk_1.default.red('❌ ' + i18n.t('cli.errors.unsupportedFormat', { format: ext })));
                process.exit(1);
            }
            // Initialize generator
            const generator = new generator_1.OpenAPICodeGenerator({
                outputDir: path.resolve(options.output),
                basePackage: options.package,
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
            console.log(chalk_1.default.green(i18n.t('cli.completed')));
            console.log(chalk_1.default.blue(i18n.t('cli.outputDir', { path: result.outputDir })));
            console.log(chalk_1.default.blue(i18n.t('cli.fileCount', { count: result.fileCount })));
            if (!options.verbose) {
                console.log(chalk_1.default.gray(i18n.t('cli.verboseHint')));
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(chalk_1.default.red('❌ Error: ' + errorMessage));
            process.exit(1);
        }
    });
    program.parse();
}
if (require.main === module) {
    main().catch((error) => {
        console.error(chalk_1.default.red('❌ Unexpected error:'), error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map