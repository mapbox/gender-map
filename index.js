var TileReduce = require('tile-reduce');
var turf = require('turf');
var _ = require('underscore');
var async = require('async');
var request = require('request');
var argv = require('minimist')(process.argv.slice(2));
var area = JSON.parse(argv.area);
var fs = require('fs');
var opts = {
  zoom: 15,
  tileLayers: [
      {
        name: 'streets',
        mbtiles: __dirname+'/latest.planet.mbtiles',
        layers: ['osm']
      }
    ],
  map: __dirname+'/match.js'
};

var tilereduce = TileReduce(area, opts);

var matched = turf.featurecollection([]);

tilereduce.on('reduce', function(result){
  matched.features = matched.features.concat(result.features);
});

tilereduce.on('end', function(error) {
  var dictionary = {};    
  var nameCache = [], uniqueNameCache = [];
  matched.features.forEach(function(elem, index, array){
    nameCache.push(elem.properties.name);
  });

  uniqueNameCache = _.uniq(nameCache);
  fs.readFile(__dirname + "/dictionary.txt", 'utf-8', function(error, text) {
    var words = text.split("\n");
    for (var i = 0; i < words.length; i++) {
      dictionary[ words[i] ] = true;
    }
    async.mapLimit(uniqueNameCache,10,callNamSor,endOfAsync);
  });

  function endOfAsync(err, result) {
    var i;
    //convert result JSON into a proper key-value pair JSON
    result = JSON.stringify(result);
    result = result.replace(/\{/g,'').replace(/\}/g,'').replace('[', '{').replace(']','}');
    result = JSON.parse(result);

    for(i=0; i< matched.features.length;i++){
        var currentName = matched.features[i].properties.name;
        if(currentName in result){
            matched.features[i].properties["gender"] = result[currentName];
        }
    }
    console.log(JSON.stringify(matched));

  }

  function callNamSor(uniqueName, callback) {

    var uniqueNameSplit = uniqueName.toLowerCase().split(" ");
    uniqueNameSplit = nameWithoutTokens(uniqueNameSplit);
    var uniqueNameSplitLength = uniqueNameSplit.length;

    if(uniqueNameSplitLength === 0){
      callback(null,{"gender" : "ungendered"});
    }

    else{
      var names = [];
      uniqueNameSplit.forEach(function (element, index, array) {
        if (!dictionary[element]) {
          names.push(element);
        }
      });

      // name is things that are not in dictionary
      // uniqueNameSplit is all of it.
      var firstName = '';
      var lastName = '';

      if (names.length > 1) {
        firstName = _.initial(names).join(' ');
        lastName = _.last(names);
      } else if (names.length === 1) {
        firstName = _.first(names);
        lastName = ' ';
      }

      firstName = (firstName.indexOf('/') != -1) ? '' : firstName;
      lastName = (firstName.indexOf('/') != -1) ? '' : firstName;

      var callbackData = {};
      if(firstName !== '' && lastName !== ''){
        var options = {
          url: 'http://api.namsor.com/onomastics/api/json/gender/'+firstName+'/'+lastName+'/fr'
        };

         request(options,
          function(error, response, body) {
          body = JSON.parse(body);
          callbackData[uniqueName] = body["gender"];
          callback(null, callbackData);
        });
      }
      else{
        callback(null, {'gender': 'ungendered'});
      }
    }
  }

  function nameWithoutTokens(uniqueNameSplit) {
    var tokens = ['road', 'street', 'highway', 'marg','rasthe','rasta','raste','rastha','salai','vazhi','dhari', "st", "rd"];
    return _.difference(uniqueNameSplit, tokens);
  }

});


tilereduce.run();
