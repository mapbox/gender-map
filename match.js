var turf = require('turf');
var cover = require('tile-cover');
var tilebelt = require('tilebelt');
var normalize = require('geojson-normalize');
var flatten = require('geojson-flatten');
var _ = require('underscore');

module.exports = function match(tileLayers, tile, done){
  var osmRoads = cleanLines(normalize(flatten(clip(tileLayers.streets.osm, tile))));
  done(null,osmRoads); 
}

function lineToPoints(line) {
  var points = line.geometry.coordinates.map(function(coord) {
    return {
      'type': 'Feature',
      'properties': {},
      'geometry': {
        'type': 'Point',
        'coordinates': coord
      }
    }
  });
  return turf.featurecollection(points);
}

function clip(lines, tile) {
  lines.features = lines.features.map(function(line){
    try {
      var clipped = turf.intersect(line, turf.polygon(tilebelt.tileToGeoJSON(tile).coordinates));
      clipped.properties = line.properties;
      return clipped;
    } catch(e){
      return;
    }
  });
  lines.features = lines.features.filter(function(line){
    if(line) return true;
  });
  return lines;
}

function cleanLines (lines) {
  lines.features = lines.features.filter(function(line){
    var lineIsHighway = (line.properties.highway == "primary" || line.properties.highway == "secondary" || line.properties.highway == "residential" || 
                         line.properties.highway == "unclassified" || line.properties.highway == "trunk" ||
                         line.properties.highway == "tertiary" || line.properties.highway == "tunnel" || line.properties.highway == "bridge" ||
                         line.properties.highway == "track" || line.properties.highway == "path" || line.properties.highway == "living_street");

    if((line.geometry.type === 'LineString' || line.geometry.type === 'MultiLineString') && lineIsHighway){
      var roadName = line.properties.name;
      if(roadName && !(/\d/.test(roadName) || roadName.match(/cross/i) || roadName.match(/main/i))){
        return true;
      }
    }
  });
  return lines;
}
