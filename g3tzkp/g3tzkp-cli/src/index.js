#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs';
import { deployer } from './deployer.js';
import { startGateway, stopGateway } from './gateway.js';
import { registerProtocol, unregisterProtocol } from './protocol-handler.js';

const program = new Command();

program
  .name('g3tzkp-web')
  .description('G3TZKP Web - Deploy and serve decentralized web apps')
  .version('1.0.0');

program
  .command('deploy <directory>')
  .description('Deploy a web app to the G3TZKP network')
  .option('-n, --name <name>', 'Human-readable name (max 9 chars)', 'APP')
  .option('-v, --version <version>', 'App version', '1.0.0')
  .option('-d, --description <description>', 'App description')
  .action(async (directory, options) => {
    const spinner = ora('Scanning build directory...').start();
    
    try {
      const dirPath = path.resolve(directory);
      
      spinner.text = 'Creating manifest and chunks...';
      const result = await deployer.deploy(dirPath, {
        name: options.name,
        version: options.version,
        description: options.description
      });

      spinner.text = 'Saving deployment data...';
      const deployDir = path.join(process.env.HOME || process.env.USERPROFILE, '.g3tzkp', 'deployments');
      fs.mkdirSync(deployDir, { recursive: true });
      
      const deployPath = path.join(deployDir, `${result.claim.name}.json`);
      fs.writeFileSync(deployPath, JSON.stringify({
        manifest: result.manifest,
        chunks: Object.fromEntries(
          Array.from(result.chunks.entries()).map(([hash, chunk]) => [hash, chunk])
        ),
        claim: result.claim,
        deployedAt: Date.now()
      }, null, 2));

      spinner.succeed(chalk.green('App deployed successfully!'));
      
      console.log('');
      console.log(chalk.cyan('  App ID:    ') + chalk.white(result.stats.appId));
      console.log(chalk.cyan('  URL:       ') + chalk.white(result.stats.url));
      console.log(chalk.cyan('  Web URL:   ') + chalk.white(result.stats.webUrl));
      console.log(chalk.cyan('  Size:      ') + chalk.white(formatBytes(result.stats.totalSize)));
      console.log(chalk.cyan('  Files:     ') + chalk.white(result.stats.fileCount));
      console.log(chalk.cyan('  Chunks:    ') + chalk.white(result.stats.chunkCount));
      console.log('');
      console.log(chalk.dim('Run `g3tzkp-web gateway start` to serve your app locally'));
      
    } catch (error) {
      spinner.fail(chalk.red('Deployment failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('gateway')
  .description('Manage the local gateway server')
  .argument('<action>', 'start, stop, or status')
  .option('-p, --port <port>', 'Gateway port', '8080')
  .action(async (action, options) => {
    const port = parseInt(options.port);
    
    switch (action) {
      case 'start':
        console.log(chalk.cyan(`Starting G3TZKP Gateway on port ${port}...`));
        await startGateway(port);
        console.log(chalk.green(`Gateway running at http://localhost:${port}`));
        console.log(chalk.dim('Access apps at: http://localhost:' + port + '/<APP_NAME>'));
        break;
        
      case 'stop':
        await stopGateway();
        console.log(chalk.yellow('Gateway stopped'));
        break;
        
      case 'status':
        console.log(chalk.cyan('Gateway status: ') + chalk.white('checking...'));
        break;
        
      default:
        console.error(chalk.red(`Unknown action: ${action}`));
        console.log(chalk.dim('Available actions: start, stop, status'));
    }
  });

program
  .command('protocol')
  .description('Register g3tzkp:// protocol handler with the OS')
  .argument('<action>', 'register or unregister')
  .action(async (action) => {
    switch (action) {
      case 'register':
        console.log(chalk.cyan('Registering g3tzkp:// protocol handler...'));
        await registerProtocol();
        console.log(chalk.green('Protocol handler registered successfully!'));
        console.log(chalk.dim('You can now open g3tzkp://APP_NAME in any browser'));
        break;
        
      case 'unregister':
        console.log(chalk.cyan('Unregistering g3tzkp:// protocol handler...'));
        await unregisterProtocol();
        console.log(chalk.yellow('Protocol handler unregistered'));
        break;
        
      default:
        console.error(chalk.red(`Unknown action: ${action}`));
    }
  });

program
  .command('list')
  .description('List all deployed apps')
  .action(() => {
    const deployDir = path.join(process.env.HOME || process.env.USERPROFILE, '.g3tzkp', 'deployments');
    
    if (!fs.existsSync(deployDir)) {
      console.log(chalk.yellow('No apps deployed yet'));
      return;
    }
    
    const files = fs.readdirSync(deployDir).filter(f => f.endsWith('.json'));
    
    if (files.length === 0) {
      console.log(chalk.yellow('No apps deployed yet'));
      return;
    }
    
    console.log(chalk.cyan('\nDeployed Apps:\n'));
    
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(deployDir, file), 'utf8'));
      console.log(chalk.white(`  ${data.manifest.name}`));
      console.log(chalk.dim(`    URL: g3tzkp://${data.manifest.name}`));
      console.log(chalk.dim(`    ID:  ${data.manifest.appId}`));
      console.log(chalk.dim(`    Deployed: ${new Date(data.deployedAt).toLocaleString()}`));
      console.log('');
    }
  });

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

program.parse();
