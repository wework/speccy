'use strict';

const nconf = require('nconf');

nconf.formats.yaml = require('nconf-yaml');

class Config {

    init(args) {
        const configFile = args.config || './speccy.yaml';

        this.load(configFile, {
            quiet: args.quiet,
            jsonSchema: args.jsonSchema,
            verbose: args.verbose,
            // Command specific options
            lint: {
                rules: args.rules,
                skip: args.skip,
            },
            resolve: {
                output: args.output,
            },
            serve: {
                port: args.port,
            }
        });
    }

    load(file, supplied) {
        // 1, check the supplied values
        nconf.add('supplied', {
            type: 'literal',
            store: this.cleanObject(supplied),
        });

        // 2, look in config file (e.g: speccy.yaml)
        nconf.add('local', {
            type: 'file',
            format: nconf.formats.yaml,
            file,
        });
    }

    get(key, defaultValue) {
        // Search through all known stores for the value
        const value = nconf.get(key);
        return (value === undefined) ? defaultValue : value;
    }

    // Don't want an object full of null
    cleanObject(object) {
        const cleaned = {};
        Object.keys(object).forEach(key => {
            const value = object[key];
            if (value === undefined || value === null) {
                return;
            } else if (typeof value === "object" && !Array.isArray(value)) {
                cleaned[key] = this.cleanObject(value);
            } else {
                cleaned[key] = value;
            }
        });
        return cleaned;
    }
}

module.exports = new Config;
