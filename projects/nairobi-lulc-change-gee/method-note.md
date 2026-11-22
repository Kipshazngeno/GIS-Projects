# Nairobi County Land Cover and Vegetation Condition: Technical Method Note

## 1. Purpose

This demonstration examines mapped land-cover patterns and vegetation-index differences in Nairobi County using Google Earth Engine. It is designed as a reproducible portfolio project connecting satellite remote sensing, LULC analysis, spatial statistics and environmental interpretation.

## 2. Study design

Two multi-year windows are compared: 2017–2019 and 2023–2025. A multi-year approach can reduce dependence on individual scenes, but it can also conceal within-period variability. A matched-season sensitivity analysis is recommended before interpreting change.

## 3. Data

**Dynamic World V1:** 10 m, Sentinel-2-derived land-cover labels and nine class probability bands. The workflow masks labels where the maximum class probability is below 0.60 and computes the temporal mode for each period. The product is model-derived and requires independent local validation.

**Sentinel-2 SR Harmonized:** Level-2A surface reflectance used to calculate NDVI. The script masks SCL classes associated with cloud shadow, medium/high cloud, cirrus and snow/ice, then calculates median NDVI composites for each window.

**Administrative boundary:** FAO GAUL 2015 level 1 is used to select Nairobi County. Confirm the feature count and compare the boundary with an authoritative source before formal reporting.

## 4. Processing

1. Select Nairobi County boundary and define the analysis geometry.
2. Filter Dynamic World by study geometry and period.
3. Apply a top-class probability threshold to each label image.
4. Generate period-specific modal LULC composites.
5. Calculate class area in hectares using pixel area and grouped reduction.
6. Encode class transitions using baseline class × 10 + recent class.
7. Filter Sentinel-2 SR Harmonized by period and geometry.
8. Mask cloud/shadow-related SCL categories and calculate NDVI.
9. Generate median NDVI composites and subtract baseline from recent.
10. Export classified rasters, NDVI difference raster and summary tables.

## 5. Interpretation

The LULC area comparison describes changes in mapped class representation. It does not by itself identify the cause of change. NDVI is a spectral vegetation indicator and should not be interpreted alone as proof of land degradation or ecosystem recovery. Urban shadow, soil background, seasonal variation, mixed pixels and image availability can affect results.

## 6. Validation requirements

A final scientific report should include independent reference data. Use a stratified sample design covering the mapped classes and important transition categories. Reference labels should be interpreted independently from the Dynamic World classification, using suitable high-resolution imagery and/or field verification. Report the sampling design, reference dates, confusion matrix, overall accuracy, class-specific user's and producer's accuracy, and uncertainty. Do not report accuracy values until this process is completed.

## 7. Limitations

- The administrative boundary vintage may not match the current official county boundary.
- The 0.60 confidence threshold is a parameter choice and should be tested.
- Multi-year mode composites can hide seasonal and intra-period dynamics.
- Dynamic World classification errors can propagate into area and transition statistics.
- NDVI does not measure all dimensions of vegetation health or land degradation.
- The initial script does not perform independent accuracy assessment or causal attribution.

## 8. Reproducibility

The complete JavaScript workflow is in `gee/nairobi_lulc_change_ndvi.js`. It prints image counts and creates export tasks for CSV and GeoTIFF outputs. Record the date of execution, code version, dataset versions, parameters, exports and validation decisions in the final case study.
