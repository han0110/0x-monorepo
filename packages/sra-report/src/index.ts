#!/usr/bin/env node

import { ZeroEx } from '0x.js';
import { assert } from '@0xproject/assert';
import { HttpClient } from '@0xproject/connect';
import { Schema, schemas } from '@0xproject/json-schemas';
import { promisify } from '@0xproject/utils';
import chalk from 'chalk';
import * as _ from 'lodash';
import * as newman from 'newman';
import * as yargs from 'yargs';

import * as sraReportCollectionJSON from '../postman_configs/collections/sra_report.postman_collection.json';

import { postmanEnvironmentFactory } from './postman_environment_factory';
import { utils } from './utils';

const newmanRunAsync = promisify<void>(newman.run);
const DEFAULT_NETWORK_ID = 1;
const SUPPORTED_NETWORK_IDS = [1, 42];

// extract command line arguments
const args = yargs
    .option('url', {
        alias: ['u'],
        describe: 'API endpoint to test for standard relayer API compliance',
        type: 'string',
        demandOption: true,
    })
    .option('output', {
        alias: ['o', 'out'],
        describe: 'Folder where to write the reports',
        type: 'string',
        normalize: true,
        demandOption: false,
    })
    .option('network-id', {
        alias: ['n'],
        describe: 'ID of the network that the API is serving orders from',
        type: 'number',
        default: DEFAULT_NETWORK_ID,
    })
    .example("$0 --url 'http://api.example.com' --out 'src/contracts/generated/' --network-id 42", 'Full usage example')
    .argv;
// perform extra validation on command line arguments
try {
    assert.isHttpUrl('args', args.url);
} catch (err) {
    utils.log(`${chalk.red(`Invalid url format:`)} ${args.url}`);
    process.exit(1);
}
if (!_.includes(SUPPORTED_NETWORK_IDS, args.networkId)) {
    utils.log(`${chalk.red(`Unsupported network id:`)} ${args.networkId}`);
    utils.log(`${chalk.bold(`Supported network ids:`)} ${SUPPORTED_NETWORK_IDS}`);
    process.exit(1);
}

const mainAsync = async () => {
    const httpClient = new HttpClient(args.url);
    const orders = await httpClient.getOrdersAsync();
    const firstOrder = _.head(orders);
    if (_.isUndefined(firstOrder)) {
        throw new Error('Could not get any orders from /orders endpoint');
    }
    const orderHash = ZeroEx.getOrderHashHex(firstOrder);
    const newmanRunOptions = {
        collection: sraReportCollectionJSON,
        reporters: 'cli',
        globals: postmanEnvironmentFactory.createGlobalEnvironment(args.url, orderHash),
        environment: postmanEnvironmentFactory.createNetworkEnvironment(args.networkId),
    };
    await newmanRunAsync(newmanRunOptions);
};

mainAsync().catch(utils.log);
