'use strict';

const turf = require('turf');
const tilebelt = require('tilebelt');
const normalize = require('geojson-normalize');
const flatten = require('geojson-flatten');

module.exports = function match(tileLayers, tile, done){
  const osmRoads = cleanLines(normalize(flatten(clip(tileLayers.streets.osm, tile))));
  console.log(tileLayers.streets.osm.tile);
  done(null, osmRoads); 
};

function clip(lines, tile) {
  lines.features = lines.features.map(function(line){
    try {
      let clipped = turf.intersect(line, turf.polygon(tilebelt.tileToGeoJSON(tile).coordinates));
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

function cleanLines(lines) {
  let lineIsHighway;
  lines.features = lines.features.filter(function(line){
    switch(line.properties.highway) {
    case 'primary':
    case 'secondary':
    case 'residential':
    case 'unclassified':
    case 'trunk':
    case 'tertiary':
    case 'tunnel':
    case 'bridge':
    case 'track':
    case 'path':
    case 'living_street':
      lineIsHighway = line.properties.highway;
    }

    if((line.geometry.type === 'LineString' || line.geometry.type === 'MultiLineString') && lineIsHighway){
      let roadName = line.properties.name;
      if(roadName && !(/\d/.test(roadName) || roadName.match(/cross/i) || roadName.match(/main/i))){
        return true;
      }
    }
  });
  return lines;
}
