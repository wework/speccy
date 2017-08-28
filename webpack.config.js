'use strict';
var webpack = require('webpack');

var commonsPlugin =
    new webpack.optimize.CommonsChunkPlugin('common');

module.exports = {
    node: {
        fs: "empty"
    },
    entry: {
        Converter: './index.js',
        Validator: './validate.js'
    },
    output: {
        filename: 'dist/[name].js', // Template based on keys in entry above
        library: '[name]', // was constant
        libraryTarget: 'var'
    },
    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: 'babel-loader',
                query: {
                    presets: ['babel-preset-es2015'].map(require.resolve)
                }
            }
        ]
    },
    plugins: [commonsPlugin]
};
