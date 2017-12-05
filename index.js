'use strict';

const BASE_URL = 'http://api.namsor.com/onomastics/api/json/gender';
const PLACES_DIRECTORY = `${__dirname}/places`;
const DICTIONARY_DIRECTORY = `${__dirname}/dictionaries`;
const TileReduce = require('tile-reduce');
const turf = require('turf');
const _ = require('underscore');
const async = require('async');
const request = require('request');
const argv = require('minimist')(process.argv.slice(2));
const area = JSON.parse(argv.area);
const place = argv.place;
const fs = require('fs');

function main() {
  let matched = turf.featurecollection([]);

  const opts = {
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
  const tilereduce = TileReduce(area, opts);

  let tokens;
  let names;
  let whichDictionaries;

  let placeJSON = fs.readFileSync(`${PLACES_DIRECTORY}/${place}.json`, 'utf-8');

  if (!placeJSON) {
    console.log(place + 'file doesn\'t exist');
  } else {
    placeJSON = JSON.parse(placeJSON);
  }

  let dictionaryWords = [];
  tokens = placeJSON['tokens'] || [];
  names = placeJSON['names'] || {};
  whichDictionaries = placeJSON['dictionaries'] || [];

  whichDictionaries.forEach(function(el) {
    const currentDictText = fs.readFileSync(`${DICTIONARY_DIRECTORY}/${el}.txt`, 'utf-8');
    const currentDictWords = currentDictText.split(/\r\n|\r|\n/g);
    dictionaryWords = dictionaryWords.concat(currentDictWords);
  });

  tilereduce.on('reduce', (result) => {
    matched.features = matched.features.concat(result.features);
  });

  tilereduce.on('end', () => {
    let nameCache = [], uniqueNameCache = [];

    matched.features.forEach(function(elem) {
      nameCache.push(elem.properties.name);
    });

    uniqueNameCache = _.uniq(nameCache);

    async.mapLimit(uniqueNameCache, 10, checkplace, endOfAsync);


    function checkplace(uniqueName, callback) {
      let callbackData = {};
      if (uniqueName in names) {
        callbackData[uniqueName] = names[uniqueName];
        callback(null, callbackData);
      } else {
        let uniqueNameSplit = uniqueName.toLowerCase().split(' ');
        uniqueNameSplit = nameWithoutTokens(uniqueNameSplit);

        if (!uniqueNameSplit.length) {
          callback(null, { gender: 'ungendered' });
        } else {
          let splitNames = [];
          uniqueNameSplit.forEach(function(element) {
            if (dictionaryWords.indexOf(element) == -1) {
              splitNames.push(element);
            }
          });

          let firstName = '';
          let lastName = '';

          if (splitNames.length > 1) {
            firstName = _.initial(splitNames).join(' ');
            lastName = _.last(splitNames);
          } else if (splitNames.length === 1) {
            firstName = _.first(splitNames);
            lastName = ' ';
          }

          firstName = (firstName.indexOf('/') !== -1) ? null : firstName;
          lastName = (firstName.indexOf('/') !== -1) ? null : firstName;

          if (firstName && lastName) {
            callNamSor(uniqueName, firstName, lastName, (err, data) => {
              callback(null, data);

            });
          } else {
            callback(null, { gender: 'ungendered' });
          }
        }
      }

    }

    function callNamSor(uniqueName, firstName, lastName, callback) {
      let callbackData = {};

      request(`${BASE_URL}/${firstName}/${lastName}/${placeJSON['country']}`,  (error, response, body) => {
        body = JSON.parse(body);
        callbackData[uniqueName] = body['gender'];
        callback(null, callbackData);
      });
    }

    function endOfAsync(err, resultArray) {
      console.log('endOfAsync ', matched);
      let i;

      let resultObj = {};
      resultArray.forEach(function(r) {
        const key = _.keys(r)[0];
        const value = r[key];
        resultObj[key] = value;
      });

      for (i = 0; i < matched.features.length; i++) {
        const currentName = matched.features[i].properties.name;
        if (currentName in resultObj) {
          matched.features[i].properties['gender'] = resultObj[currentName];
        }
        console.log(JSON.stringify(matched));
      }

    }

    function nameWithoutTokens(uniqueNameSplit) {
      return _.difference(uniqueNameSplit, tokens);
    }

  });


  tilereduce.run();

}

main();