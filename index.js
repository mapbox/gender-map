'use strict';

var TileReduce = require('tile-reduce');
var turf = require('turf');
var _ = require('underscore');
var async = require('async');
var request = require('request');
var argv = require('minimist')(process.argv.slice(2));
var area = JSON.parse(argv.area);
var config = argv.config;
var fs = require('fs');
var opts = {
    zoom: 15,
    tileLayers: [
        {
            name: 'streets',
            mbtiles: __dirname + '/latest.planet.mbtiles',
            layers: ['osm']
        }
    ],
    map: __dirname + '/match.js'
};

var tilereduce = TileReduce(area, opts);

var matched = turf.featurecollection([]);

var tokens;
var names;
var whichDictionaries;

var configJSON = fs.readFileSync(__dirname + '/' + config + '.json', 'utf-8');

if (!configJSON) {
    console.log(config + 'file doesn\'t exist');
} else {
    configJSON = JSON.parse(configJSON);
}

var dictionaryWords = [];
tokens = configJSON['tokens'] || [];
names = configJSON['names'] || {};
whichDictionaries = configJSON['dictionaries'] || [];

whichDictionaries.forEach(function (el) {
    var currentDictText = fs.readFileSync(__dirname + '/' + el + '.txt', 'utf-8');
    var currentDictWords = currentDictText.split(/\r\n|\r|\n/g);
    dictionaryWords = dictionaryWords.concat(currentDictWords);
});

tilereduce.on('reduce', function (result) {
    matched.features = matched.features.concat(result.features);
});

tilereduce.on('end', function (error) {
    var nameCache = [], uniqueNameCache = [];

    matched.features.forEach(function (elem) {
        nameCache.push(elem.properties.name);
    });

    uniqueNameCache = _.uniq(nameCache);

    async.mapLimit(uniqueNameCache, 10, checkConfig, endOfAsync);


    function checkConfig(uniqueName, callback) {
        var callbackData = {};
        if (uniqueName in names) {
            callbackData[uniqueName] = names[uniqueName];
            callback(null, callbackData);
        } else {
            var uniqueNameSplit = uniqueName.toLowerCase().split(' ');
            uniqueNameSplit = nameWithoutTokens(uniqueNameSplit);
            var uniqueNameSplitLength = uniqueNameSplit.length;

            if (uniqueNameSplitLength === 0) {
                callback(null, {'gender': 'ungendered'});
            } else {
                var splitNames = [];
                uniqueNameSplit.forEach(function (element) {
                    if (dictionaryWords.indexOf(element) == -1) {
                        splitNames.push(element);
                    }
                });

                // name is things that are not in dictionary
                // uniqueNameSplit is all of it.
                var firstName = '';
                var lastName = '';

                if (splitNames.length > 1) {
                    firstName = _.initial(splitNames).join(' ');
                    lastName = _.last(splitNames);
                } else if (splitNames.length === 1) {
                    firstName = _.first(splitNames);
                    lastName = ' ';
                }

                firstName = (firstName.indexOf('/') !== -1) ? '' : firstName;
                lastName = (firstName.indexOf('/') !== -1) ? '' : firstName;

                var callbackData = {};
                if (firstName !== '' && lastName !== '') {
                    callNamSor(uniqueName, firstName, lastName, function (err, data){
                        callback(null, data);

                    });
                } else {
                    callback(null, {'gender': 'ungendered'});
                }
            }
        }

    }

    function callNamSor(uniqueName, firstName, lastName, callback) {
        var callbackData = {};
        // var options = {
        //     url: 'http://api.namsor.com/onomastics/api/json/gender/' + firstName + '/' + lastName + '/' + configJSON.country
        // };

        request('http://api.namsor.com/onomastics/api/json/gender/' + firstName + '/' + lastName + '/' + configJSON["country"], function (error, response, body) {
            body = JSON.parse(body);
            callbackData[uniqueName] = body['gender'];
            // console.log("NAMSOR! " , JSON.stringify(callbackData));
            callback(null, callbackData);
        });
    }

    function endOfAsync(err, resultArray) {
        var i;

        // console.log("resultArray  " , resultArray);
        var resultObj = {};
        resultArray.forEach(function (r) {
            var key = _.keys(r)[0];
            var value = r[key];
            resultObj[key] = value;
        });

        for (i = 0; i < matched.features.length; i++) {
            var currentName = matched.features[i].properties.name;
            if (currentName in resultObj) {
                matched.features[i].properties['gender'] = resultObj[currentName];
            }
        }
        console.log(JSON.stringify(matched));

    }

    function nameWithoutTokens(uniqueNameSplit) {
        return _.difference(uniqueNameSplit, tokens);
    }

});


tilereduce.run();
