// ============================================================================
// NAIROBI COUNTY | LAND COVER CHANGE & VEGETATION CONDITION (GEE)
// Author: Kipkirui Ngeno | Portfolio demonstration
// Platform: Google Earth Engine Code Editor (JavaScript)
// Periods: 2017–2019 baseline and 2023–2025 comparison
//
// IMPORTANT:
// - This is a reproducible analysis workflow, not a completed/validated
//   scientific finding until it has been run, checked and independently
//   validated in Earth Engine.
// - Dynamic World is a model-derived 10 m land-cover product. Its outputs
//   should be checked against independent reference data before strong
//   accuracy or change claims are made.
// - County boundary uses FAO GAUL level 1. Check boundary suitability and
//   document the version/administrative definition used in final reporting.
// ============================================================================

// --------------------------- 1. STUDY AREA ----------------------------------
var admin1 = ee.FeatureCollection('FAO/GAUL/2015/level1');
var nairobi = admin1
  .filter(ee.Filter.eq('ADM0_NAME', 'Kenya'))
  .filter(ee.Filter.eq('ADM1_NAME', 'Nairobi'));

print('Nairobi boundary feature count (should be 1):', nairobi.size());
print('Nairobi boundary:', nairobi);

var roi = nairobi.geometry();
Map.centerObject(roi, 10);
Map.addLayer(
  nairobi.style({color: 'F4F1EA', fillColor: '00000000', width: 2}),
  {},
  'Nairobi County boundary'
);

// ---------------------- 2. ANALYSIS PERIODS --------------------------------
var baselineStart = '2017-01-01';
var baselineEnd   = '2020-01-01'; // end date is exclusive
var recentStart   = '2023-01-01';
var recentEnd     = '2026-01-01'; // end date is exclusive

// ---------------------- 3. DYNAMIC WORLD LULC -------------------------------
var dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
  .filterBounds(roi);

var probabilityBands = [
  'water', 'trees', 'grass', 'flooded_vegetation', 'crops',
  'shrub_and_scrub', 'built', 'bare', 'snow_and_ice'
];

function confidentLabel(image) {
  var maxProbability = image.select(probabilityBands).reduce(ee.Reducer.max());
  return image.select('label')
    .updateMask(maxProbability.gte(0.60))
    .rename('lulc')
    .copyProperties(image, ['system:time_start']);
}

function makeLulcComposite(startDate, endDate, label) {
  var collection = dw
    .filterDate(startDate, endDate)
    .map(confidentLabel);

  print(label + ' Dynamic World scenes:', collection.size());

  return collection.mode()
    .rename('lulc')
    .clip(roi)
    .set('period', label);
}

var lulcBaseline = makeLulcComposite(
  baselineStart, baselineEnd, '2017-2019'
);
var lulcRecent = makeLulcComposite(
  recentStart, recentEnd, '2023-2025'
);

var lulcPalette = [
  '419BDF', // 0 Water
  '397D49', // 1 Trees
  '88B053', // 2 Grass
  '7A87C6', // 3 Flooded vegetation
  'E0C879', // 4 Crops
  'DFC35A', // 5 Shrub and scrub
  'C4281B', // 6 Built area
  'A59B8F', // 7 Bare ground
  'B39FE1'  // 8 Snow and ice
];

var lulcVis = {min: 0, max: 8, palette: lulcPalette};
Map.addLayer(lulcBaseline, lulcVis, 'LULC 2017–2019 (Dynamic World)', false);
Map.addLayer(lulcRecent, lulcVis, 'LULC 2023–2025 (Dynamic World)', true);

// ------------------------- 4. LULC CHANGE ----------------------------------
// Transition code = (baseline class * 10) + recent class.
// Example: 16 = baseline trees (1), recent built (6).
var transition = lulcBaseline.multiply(10)
  .add(lulcRecent)
  .rename('transition')
  .clip(roi);

Map.addLayer(
  transition.randomVisualizer(),
  {},
  'LULC transition codes (exploratory)',
  false
);

// ---------------------- 5. CLASS AREA STATISTICS ---------------------------
var classNames = ee.List([
  'Water', 'Trees', 'Grass', 'Flooded vegetation', 'Crops',
  'Shrub and scrub', 'Built area', 'Bare ground', 'Snow and ice'
]);

function areaByClass(classImage, periodName) {
  var areaImage = ee.Image.pixelArea().divide(10000)
    .rename('area_ha')
    .addBands(classImage.rename('class'));

  var grouped = areaImage.reduceRegion({
    reducer: ee.Reducer.sum().group({
      groupField: 1,
      groupName: 'class'
    }),
    geometry: roi,
    scale: 10,
    maxPixels: 1e13,
    tileScale: 4
  });

  var groups = ee.List(grouped.get('groups'));

  return ee.FeatureCollection(groups.map(function(item) {
    item = ee.Dictionary(item);
    var classId = ee.Number(item.get('class')).toInt();
    return ee.Feature(null, {
      period: periodName,
      class_id: classId,
      class_name: classNames.get(classId),
      area_ha: item.get('sum')
    });
  }));
}

var baselineArea = areaByClass(lulcBaseline, '2017-2019');
var recentArea = areaByClass(lulcRecent, '2023-2025');
var areaTable = baselineArea.merge(recentArea);

print('Area by class (hectares):', areaTable);

Export.table.toDrive({
  collection: areaTable,
  description: 'Nairobi_DynamicWorld_LULC_Area_2017_2019_vs_2023_2025',
  fileFormat: 'CSV'
});

// ------------------------- 6. SENTINEL-2 NDVI -------------------------------
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(roi);

function maskS2(image) {
  var scl = image.select('SCL');
  // Remove shadow, medium/high cloud, cirrus and snow/ice classes.
  var mask = scl.neq(3)
    .and(scl.neq(8))
    .and(scl.neq(9))
    .and(scl.neq(10))
    .and(scl.neq(11));

  return image.updateMask(mask)
    .divide(10000)
    .copyProperties(image, ['system:time_start']);
}

function makeNdvi(startDate, endDate, label) {
  var collection = s2
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
    .map(maskS2);

  print(label + ' Sentinel-2 scenes:', collection.size());

  return collection.map(function(image) {
    return image.normalizedDifference(['B8', 'B4'])
      .rename('NDVI')
      .copyProperties(image, ['system:time_start']);
  }).median().clip(roi).rename('NDVI');
}

var ndviBaseline = makeNdvi(baselineStart, baselineEnd, '2017-2019');
var ndviRecent = makeNdvi(recentStart, recentEnd, '2023-2025');
var ndviDifference = ndviRecent.subtract(ndviBaseline).rename('NDVI_change');

var ndviVis = {
  min: 0,
  max: 0.8,
  palette: ['8C510A', 'D8B365', 'F6E8C3', 'A6D96A', '1A9850']
};

Map.addLayer(ndviBaseline, ndviVis, 'Median NDVI 2017–2019', false);
Map.addLayer(ndviRecent, ndviVis, 'Median NDVI 2023–2025', false);
Map.addLayer(
  ndviDifference,
  {min: -0.35, max: 0.35, palette: ['A50026', 'F7F7F7', '006837']},
  'NDVI difference (recent minus baseline)',
  false
);

// -------------------------- 7. NDVI SUMMARY --------------------------------
var ndviSummary = ee.FeatureCollection([
  ee.Feature(null, {
    period: '2017-2019',
    mean_ndvi: ndviBaseline.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: roi,
      scale: 10,
      maxPixels: 1e13,
      tileScale: 4
    }).get('NDVI')
  }),
  ee.Feature(null, {
    period: '2023-2025',
    mean_ndvi: ndviRecent.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: roi,
      scale: 10,
      maxPixels: 1e13,
      tileScale: 4
    }).get('NDVI')
  })
]);

print('County-wide mean NDVI summary (exploratory):', ndviSummary);

Export.table.toDrive({
  collection: ndviSummary,
  description: 'Nairobi_Mean_NDVI_2017_2019_vs_2023_2025',
  fileFormat: 'CSV'
});

// ----------------------------- 8. EXPORTS ----------------------------------
// Export the classified land-cover maps. Run each task from the Tasks tab.
Export.image.toDrive({
  image: lulcBaseline.toInt8(),
  description: 'Nairobi_LULC_DynamicWorld_2017_2019',
  folder: 'GEE_Nairobi_Portfolio',
  fileNamePrefix: 'Nairobi_LULC_2017_2019',
  region: roi,
  scale: 10,
  maxPixels: 1e13
});

Export.image.toDrive({
  image: lulcRecent.toInt8(),
  description: 'Nairobi_LULC_DynamicWorld_2023_2025',
  folder: 'GEE_Nairobi_Portfolio',
  fileNamePrefix: 'Nairobi_LULC_2023_2025',
  region: roi,
  scale: 10,
  maxPixels: 1e13
});

Export.image.toDrive({
  image: ndviDifference,
  description: 'Nairobi_NDVI_Change_2017_2019_to_2023_2025',
  folder: 'GEE_Nairobi_Portfolio',
  fileNamePrefix: 'Nairobi_NDVI_Change_2017_2019_to_2023_2025',
  region: roi,
  scale: 10,
  maxPixels: 1e13
});

// ----------------------------- 9. LEGEND -----------------------------------
var legend = ui.Panel({
  style: {position: 'bottom-left', padding: '8px 12px'}
});
legend.add(ui.Label({
  value: 'Dynamic World land-cover classes',
  style: {fontWeight: 'bold', margin: '0 0 6px 0'}
}));

var legendNames = [
  'Water', 'Trees', 'Grass', 'Flooded vegetation', 'Crops',
  'Shrub and scrub', 'Built area', 'Bare ground', 'Snow and ice'
];

for (var i = 0; i < legendNames.length; i++) {
  var colorBox = ui.Label('', {
    backgroundColor: '#' + lulcPalette[i],
    padding: '8px',
    margin: '0 6px 4px 0'
  });
  var description = ui.Label(legendNames[i], {margin: '0 0 4px 0'});
  legend.add(ui.Panel([colorBox, description], ui.Panel.Layout.Flow('horizontal')));
}
Map.add(legend);

print('Workflow ready. Inspect map layers, review console counts, and run export tasks.');
