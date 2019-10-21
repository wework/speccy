'use strict';

const nconf = require('nconf');

nconf.formats.yaml = require('nconf-yaml');

class Config {

    init(args) {
        const configFile = (args.parent && args.parent.config) ? args.parent.config : './speccy.yaml';

        this.load(configFile, {
            quiet: args.quiet,
            jsonSchema: args.jsonSchema,
            verbose: args.verbose,
            // Command specific options
            lint: {
                rules: this.notEmptyArray(args.rules),
                skip: this.notEmptyArray(args.skip),
                output: args.output,
                outputFile: args.outputFile
            },
            resolve: {
                output: args.output,
                internalRefs: args.internalRefs
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

        if (!nconf.get('quiet') && nconf.get('verbose') > 2) {
            console.error('LOADING CONFIG', file);
        }
    }

    get(key, defaultValue) {
        // Search through all known stores for the value
        const value = nconf.get(key);
        const result = (value === undefined) ? defaultValue : value;
        if (!nconf.get('quiet') && nconf.get('verbose') > 2) {
            console.error(`CONFIG VALUE ${key} = ${result} (default = ${defaultValue})`)
        }
        return result
    }

    // Don't want an object full of null
    cleanObject(object) {
        const cleaned = {};
        Object.keys(object).forEach(key => {
            const value = object[key];
            if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
                return;
            } else if (typeof value === "object" && !Array.isArray(value)) {
                cleaned[key] = this.cleanObject(value);
            } else {
                cleaned[key] = value;
            }
        });
        return cleaned;
    }

    /**
     * Check and returns the given array if it is not empty. Otherwise it returns 'undefined'.
     * Useful for configuration options where an empty array has no meaning.
     *
     * @param array The array instance to check.
     * @returns {array|undefined} The given array; or 'undefined' if array is 'undefined' or empty.
     */
    notEmptyArray(array) {
        return array && array.length > 0 ? array : undefined;
    }
}

module.exports = new Config;
