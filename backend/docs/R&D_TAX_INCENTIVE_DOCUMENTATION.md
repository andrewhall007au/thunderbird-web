# R&D Tax Incentive Documentation
## Thunderbird Mountain Weather Intelligence Platform

**Company:** [Company Name]
**ABN:** [ABN]
**Financial Year:** 2025-2026
**Document Version:** 1.0
**Date:** 2 February 2026

---

## Executive Summary

Thunderbird is developing novel technology for delivering accurate, safety-critical mountain weather information via SMS, including satellite SMS for areas without cellular coverage. The project involves significant technical uncertainty in meteorological data processing, human-computer interaction under extreme constraints, and natural language understanding for specialized domains.

This document outlines the core R&D activities, hypotheses under investigation, experimental methodology, and validation approaches for the Australian R&D Tax Incentive program.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Core R&D Activity 1: Altitude-Adjusted Micro-Forecasting](#2-core-rd-activity-1-altitude-adjusted-micro-forecasting)
3. [Core R&D Activity 2: Derived Parameter Estimation](#3-core-rd-activity-2-derived-parameter-estimation)
4. [Core R&D Activity 3: Multi-Factor Danger Rating System](#4-core-rd-activity-3-multi-factor-danger-rating-system)
5. [Core R&D Activity 4: Satellite SMS Reliability Engineering](#5-core-rd-activity-4-satellite-sms-reliability-engineering)
6. [Core R&D Activity 5: Natural Language Weather Interface](#6-core-rd-activity-5-natural-language-weather-interface)
7. [Supporting R&D Activities](#7-supporting-rd-activities)
8. [Future R&D Roadmap](#8-future-rd-roadmap)
9. [Appendix: Test Batteries](#appendix-test-batteries)

---

## 1. Project Overview

### 1.1 Background

Mountain weather forecasting presents unique challenges not addressed by consumer weather applications:

- **Altitude variation**: Weather changes dramatically with elevation (approximately 6.5°C per 1000m), yet weather models provide data for grid cells, not specific altitudes
- **Micro-climate effects**: Mountain terrain creates localized weather patterns not captured in regional forecasts
- **Communication constraints**: Remote areas lack cellular coverage; satellite SMS is limited to 160 characters with high latency
- **Safety criticality**: Incorrect forecasts can lead to hypothermia, falls, or fatalities

### 1.2 Technical Challenges

The project addresses technical uncertainties that cannot be resolved by applying existing knowledge:

1. **Can we accurately extrapolate grid-cell weather data to arbitrary GPS coordinates and altitudes?**
2. **Can we estimate parameters not directly provided by weather APIs (cloud base, danger levels)?**
3. **Can we achieve reliable two-way communication over satellite SMS?**
4. **Can natural language processing handle ambiguous, domain-specific weather queries?**

### 1.3 Why This Qualifies as R&D

These challenges meet the R&D Tax Incentive criteria because:

- **Outcome cannot be determined in advance**: No existing literature confirms achievable accuracy for altitude-adjusted forecasting from grid-cell data in Australian alpine conditions
- **Requires systematic experimentation**: We must test hypotheses through controlled experiments with measurable outcomes
- **Generates new knowledge**: Results will advance understanding of micro-scale weather prediction and constrained human-computer interaction

---

## 2. Core R&D Activity 1: Altitude-Adjusted Micro-Forecasting

### 2.1 Technical Uncertainty

Weather models (BOM ACCESS-C, Open-Meteo) provide forecasts for grid cells at model elevation. Users require forecasts at their specific GPS location and altitude, which may differ by 500-1500m from model elevation.

**Knowledge Gap**: While the dry adiabatic lapse rate (9.8°C/km) and environmental lapse rate (~6.5°C/km) are well-established in meteorology, their accuracy for real-time forecast adjustment in complex terrain is unproven. Factors including:

- Temperature inversions
- Orographic lifting
- Katabatic winds
- Snow cover effects

...may cause actual conditions to deviate significantly from lapse-rate predictions.

### 2.2 Hypothesis

**H1.1 - Temperature Adjustment Accuracy**
> Using environmental lapse rate adjustment (0.0065°C/m), we can predict temperature at arbitrary altitudes within ±2°C of actual conditions for ≥90% of queries in Tasmanian alpine terrain.

**H1.2 - Wind Speed Extrapolation**
> Wind speed increases with altitude can be modeled using a logarithmic wind profile, achieving predictions within ±20% of actual wind speed for ≥85% of queries.

**H1.3 - Precipitation Type Prediction**
> Using adjusted temperature at altitude, we can correctly predict precipitation type (rain vs snow) for ≥90% of precipitation events.

### 2.3 Experimental Methodology

#### 2.3.1 Data Collection

| Data Source | Parameters | Collection Method |
|-------------|------------|-------------------|
| BOM ACCESS-C API | Temperature, wind, humidity at model level | Automated hourly collection |
| User GPS coordinates | Latitude, longitude, altitude | SMS input parsing |
| Weather stations | Actual temperature, wind at known altitudes | BOM AWS network |
| Field observations | Actual conditions at test locations | Manual recording during field tests |

#### 2.3.2 Experimental Design

**Experiment 1.1: Lapse Rate Validation**

1. Select 20 locations across Tasmanian highlands with known elevations
2. For each location, collect:
   - BOM forecast at model elevation
   - Our adjusted prediction at actual elevation
   - Actual observed temperature (from nearby AWS or field measurement)
3. Calculate prediction error for both raw and adjusted forecasts
4. Repeat across 100 forecast periods (different weather conditions)
5. Statistical analysis: paired t-test comparing raw vs adjusted RMSE

**Experiment 1.2: Elevation Gradient Testing**

1. Select 5 mountain transects with multiple elevation points
2. Compare predictions at 500m, 800m, 1000m, 1200m, 1400m
3. Measure error accumulation with elevation difference from model level
4. Determine maximum reliable extrapolation distance

### 2.4 Validation Approach

| Metric | Measurement Method | Success Criterion | Data Required |
|--------|-------------------|-------------------|---------------|
| Temperature RMSE | Compare predicted vs observed | RMSE < 2°C | 500 paired observations |
| Accuracy rate | % predictions within ±2°C | ≥90% | 500 predictions |
| Bias detection | Mean signed error | \|bias\| < 0.5°C | 500 predictions |
| Condition stratification | Accuracy by weather type | ≥85% in each category | 100 per category |

### 2.5 Risk Assessment

| Risk Factor | Probability | Impact | Mitigation |
|-------------|-------------|--------|------------|
| Lapse rate varies significantly with conditions | High | Predictions unreliable | Develop condition-specific lapse rates |
| Insufficient validation data | Medium | Cannot confirm accuracy | Partner with university for weather station access |
| Temperature inversions cause systematic errors | High | Failure of hypothesis | Develop inversion detection algorithm |

**Overall Risk of Hypothesis Failure: HIGH** - Justifies R&D classification

---

## 3. Core R&D Activity 2: Derived Parameter Estimation

### 3.1 Technical Uncertainty

Critical mountain safety parameters are not directly provided by weather APIs:

- **Cloud base height**: Essential for knowing if peaks will be in cloud
- **Freezing level**: Determines ice risk on exposed terrain
- **Visibility**: Affects navigation safety

We must derive these from available parameters (temperature, humidity, pressure), but the accuracy of derivation formulas in Australian alpine conditions is unknown.

### 3.2 Hypothesis

**H2.1 - Cloud Base from Lifted Condensation Level (LCL)**
> Cloud base height estimated using the LCL formula (based on surface temperature and dewpoint) will be within ±200m of actual cloud base for ≥80% of overcast conditions.

**Formula under test:**
```
LCL_height = 125 × (T_surface - T_dewpoint)
```

**H2.2 - Freezing Level Interpolation**
> Freezing level interpolated from model temperature profiles will be within ±100m of actual freezing level for ≥85% of conditions.

**H2.3 - Visibility Estimation from Humidity and Precipitation**
> Visibility can be estimated from relative humidity and precipitation rate with categorical accuracy (good/moderate/poor) for ≥80% of conditions.

### 3.3 Experimental Methodology

**Experiment 2.1: LCL Validation**

1. Identify 30 days with observable cloud base over Tasmanian highlands
2. Calculate LCL from surface observations
3. Compare with:
   - Pilot reports (PIREPS) of cloud base
   - Ceilometer data from nearest airport
   - Field observations (photography with known reference points)
4. Calculate RMSE and percentage within ±200m

**Experiment 2.2: Freezing Level Validation**

1. Collect BOM upper-air soundings for Hobart
2. Calculate interpolated freezing level for highland locations
3. Compare with:
   - Observed snow line during precipitation events
   - Temperature logger data at known elevations
4. Analyse accuracy across different synoptic patterns

### 3.4 Validation Approach

| Parameter | Ground Truth Source | Sample Size | Success Criterion |
|-----------|--------------------:|------------:|-------------------|
| Cloud base | Ceilometer + PIREPS | 100 observations | ±200m for 80% |
| Freezing level | Snow line + temp loggers | 75 events | ±100m for 85% |
| Visibility | METAR observations | 200 observations | 80% categorical accuracy |

### 3.5 Risk Assessment

**Overall Risk of Hypothesis Failure: HIGH**

The LCL formula assumes:
- Well-mixed boundary layer (often violated in mountains)
- No elevated cloud layers
- Surface observations representative of column

These assumptions frequently fail in complex terrain, creating genuine uncertainty about achievable accuracy.

---

## 4. Core R&D Activity 3: Multi-Factor Danger Rating System

### 4.1 Technical Uncertainty

No established system exists for translating weather forecasts into actionable danger ratings for mountain hikers. Existing systems (avalanche ratings, fire danger) address different hazards.

We are developing a novel composite danger rating combining:
- Wind speed and gusts
- Icing conditions (temperature + precipitation + altitude)
- Visibility (cloud base vs terrain elevation)
- Thunderstorm risk (CAPE + atmospheric instability)
- Precipitation intensity

**Knowledge Gap**: The relative weighting of these factors and threshold values for danger levels is unknown. We cannot determine in advance what combination of factors best predicts actual dangerous conditions.

### 4.2 Hypothesis

**H3.1 - Danger Rating Correlation with Incidents**
> Our composite danger rating system will show statistically significant correlation with historical Tasmania Parks & Wildlife SAR callouts (p < 0.05, r > 0.4).

**H3.2 - Expert Agreement**
> Danger ratings will match expert mountaineer assessment ≥80% of the time when presented with the same forecast data.

**H3.3 - User Comprehension**
> Users will correctly interpret danger ratings and make appropriate go/no-go decisions ≥85% of the time in scenario testing.

**H3.4 - CAPE Threshold for Thunderstorm Warning**
> CAPE values >500 J/kg will predict thunderstorm occurrence within 6 hours with ≥75% true positive rate and <30% false positive rate in Tasmanian conditions.

### 4.3 Experimental Methodology

**Experiment 3.1: Historical Incident Correlation**

1. Obtain Tasmania Parks SAR callout data (2018-2025)
2. For each incident:
   - Extract location and time
   - Reconstruct weather conditions from archived BOM data
   - Calculate what our danger rating would have been
3. Statistical analysis:
   - Correlation between danger rating and incident occurrence
   - Receiver Operating Characteristic (ROC) curve analysis
   - Optimal threshold determination

**Experiment 3.2: Expert Validation Panel**

1. Recruit panel of 10 experienced Tasmanian mountaineers
2. Present 50 weather scenarios (blinded to our rating)
3. Experts rate danger on 1-5 scale
4. Compare expert consensus with system rating
5. Calculate inter-rater reliability (Krippendorff's alpha)

**Experiment 3.3: Factor Weighting Optimization**

1. Use historical incident data as training set
2. Test multiple weighting schemes:
   - Equal weighting
   - Wind-dominant
   - Visibility-dominant
   - Machine learning optimized
3. Cross-validation to prevent overfitting
4. Select scheme with best predictive performance

### 4.4 Validation Approach

| Metric | Method | Success Criterion |
|--------|--------|-------------------|
| Incident correlation | Pearson's r with SAR data | r > 0.4, p < 0.05 |
| Expert agreement | Cohen's kappa | κ > 0.6 (substantial agreement) |
| Sensitivity | True positive rate | ≥80% of dangerous conditions rated !!! |
| Specificity | True negative rate | ≥70% of safe conditions rated safe |
| User comprehension | Scenario testing | ≥85% correct decisions |

### 4.5 Risk Assessment

**Overall Risk of Hypothesis Failure: VERY HIGH**

- Incident data may have confounding factors (experience level, preparation)
- Weather is only one factor in mountain accidents
- Expert disagreement may be high (subjective assessment)
- CAPE thresholds from US/European research may not apply to Australian conditions

This represents genuine R&D with uncertain outcome.

---

## 5. Core R&D Activity 4: Satellite SMS Reliability Engineering

### 5.1 Technical Uncertainty

Satellite SMS (Apple iPhone Emergency SOS via Globalstar) has characteristics not present in cellular SMS:

- Variable latency: 30 seconds to 5+ minutes
- Connection dependent on satellite visibility
- Limited to 160 characters
- No delivery confirmation semantics
- Unknown retry behavior

**Knowledge Gap**: No published research exists on designing reliable two-way application protocols over satellite SMS. Standard mobile messaging patterns may fail.

### 5.2 Hypothesis

**H4.1 - Delivery Reliability**
> We can achieve ≥95% successful message round-trip (user query → system response) over satellite SMS within 10 minutes.

**H4.2 - Latency Prediction**
> Satellite latency can be predicted within ±60 seconds based on time of day and geographic location, enabling user expectation setting.

**H4.3 - Optimal Retry Strategy**
> An adaptive retry strategy (vs fixed interval) will improve delivery success rate by ≥10 percentage points.

**H4.4 - Message Segmentation**
> Multi-part forecasts (3-6 SMS) will arrive in correct order ≥95% of the time using our sequencing protocol.

### 5.3 Experimental Methodology

**Experiment 4.1: Baseline Reliability Measurement**

1. Deploy field testers to 10 satellite-only locations across US, Canada, Australia
2. Each tester sends standardized test battery (20 messages)
3. Measure:
   - Delivery success rate
   - Round-trip latency
   - Message ordering for multi-part
4. Total: 500+ satellite SMS transactions

**Experiment 4.2: Latency Modeling**

1. Collect latency data across:
   - Different times of day
   - Different geographic locations
   - Different satellite visibility conditions
2. Build predictive model using regression analysis
3. Validate on held-out test set

**Experiment 4.3: Retry Strategy Comparison**

1. Implement three retry strategies:
   - Fixed interval (60s)
   - Exponential backoff
   - Adaptive (based on latency model)
2. A/B test across field test sessions
3. Compare delivery success rates

### 5.4 Validation Approach

| Metric | Measurement | Success Criterion | Sample Size |
|--------|-------------|-------------------|-------------|
| Delivery success | Round-trip within 10 min | ≥95% | 500 transactions |
| Latency prediction | MAE of predicted vs actual | ±60 seconds | 300 transactions |
| Retry improvement | Success rate delta | ≥10pp improvement | 200 per strategy |
| Message ordering | Correct sequence delivery | ≥95% | 100 multi-part |

### 5.5 Risk Assessment

**Overall Risk of Hypothesis Failure: MEDIUM-HIGH**

- Satellite infrastructure is outside our control
- Apple may change satellite SMS behavior without notice
- Geographic variation may prevent universal reliability
- Sample sizes achievable in field testing may be insufficient

---

## 6. Core R&D Activity 5: Natural Language Weather Interface

### 6.1 Technical Uncertainty

Natural language understanding for specialized domains remains an active research area. Mountain weather queries present unique challenges:

- **Domain-specific vocabulary**: "The saddle", "the col", "camp 3"
- **Ambiguous location references**: "Lake O", "that lake near high moor"
- **Implicit context**: "What about tomorrow" (referring to previous location)
- **Safety-critical interpretation**: Must not misunderstand life-safety queries
- **Constrained response**: Must compress LLM response to SMS length

**Knowledge Gap**: No published benchmarks exist for NLU accuracy on mountain weather queries. We cannot determine achievable accuracy without experimentation.

### 6.2 Hypothesis

**H5.1 - Unambiguous Query Accuracy**
> LLM-based intent extraction will correctly interpret unambiguous weather queries with ≥98% accuracy.

**H5.2 - Ambiguous Query Accuracy**
> For deliberately ambiguous queries (informal names, vague times, partial information), the system will either:
> - Correctly interpret (≥80% of cases), OR
> - Appropriately request clarification (remaining cases)
> With <2% silent failures (wrong interpretation without flagging uncertainty).

**H5.3 - Location Resolution**
> Fuzzy location matching will correctly resolve informal location names to system codes with ≥90% accuracy across 200 test variations.

**H5.4 - Context Retention**
> The system will correctly maintain conversational context across message gaps of up to 30 minutes with ≥90% accuracy.

**H5.5 - Safety Query Detection**
> 100% of safety-critical queries will be detected and handled with appropriate caveats (zero false negatives).

### 6.3 Experimental Methodology

**Experiment 5.1: Query Classification Test Battery**

1. Develop test battery of 500 queries across categories:
   - 100 unambiguous standard queries
   - 100 ambiguous location queries
   - 75 ambiguous temporal queries
   - 50 informal/slang queries
   - 50 multi-intent queries
   - 50 context-dependent queries
   - 50 safety-critical queries
   - 25 negation/conditional queries

2. For each query, define:
   - Expected command interpretation
   - Acceptable alternative interpretations
   - Required clarification triggers
   - Required safety flags

3. Run test battery against system
4. Score using rubric:
   - Correct interpretation: 1.0
   - Acceptable alternative: 0.8
   - Appropriate clarification request: 0.7
   - Silent failure: 0.0

**Experiment 5.2: Prompt Engineering Iteration**

1. Baseline measurement with initial prompt
2. Error analysis: categorize failure modes
3. Prompt refinement targeting failure categories
4. Re-test and measure improvement
5. Iterate until plateau or success threshold reached

**Experiment 5.3: Context Retention Testing**

1. Design 50 two-turn conversations
2. Vary gap between messages: 1min, 5min, 15min, 30min
3. Measure context resolution accuracy at each interval
4. Determine maximum reliable context window

**Experiment 5.4: Adversarial Testing**

1. Red team exercise: attempt to cause misinterpretation
2. Document failure modes
3. Develop mitigations
4. Re-test adversarial cases

### 6.4 Validation Approach

| Metric | Test Battery Section | Success Criterion | Sample Size |
|--------|---------------------|-------------------|-------------|
| Overall accuracy | All queries | ≥90% | 500 |
| Unambiguous accuracy | Standard queries | ≥98% | 100 |
| Ambiguous handling | Ambiguous queries | ≥80% correct OR clarification, <2% silent fail | 225 |
| Location resolution | Location variations | ≥90% | 200 |
| Context retention | Context-dependent | ≥90% within 30 min | 50 |
| Safety detection | Safety-critical | 100% detection | 50 |

### 6.5 Risk Assessment

**Overall Risk of Hypothesis Failure: HIGH**

- LLM behavior is probabilistic and may not achieve deterministic thresholds
- Domain-specific vocabulary may require fine-tuning (additional cost/complexity)
- Context retention over satellite latency is unprecedented
- Safety-critical requirement of 100% is extremely demanding

---

## 7. Supporting R&D Activities

### 7.1 Test Infrastructure Development

Development of automated testing infrastructure to validate hypotheses:

- Automated test battery execution framework
- Statistical analysis pipeline
- Field test coordination platform
- Results dashboard and reporting

**R&D Justification**: Novel infrastructure required to test hypotheses that cannot be validated with existing tools.

### 7.2 Data Collection Systems

Systems to collect validation data:

- Weather observation logging
- User query corpus collection (anonymized)
- Satellite latency measurement
- Field test result aggregation

### 7.3 Statistical Analysis

Formal statistical analysis of experimental results:

- Hypothesis testing (t-tests, chi-square, correlation)
- Confidence interval calculation
- Power analysis for sample size determination
- ROC curve analysis for threshold optimization

---

## 8. Future R&D Roadmap

### 8.1 Phase 2: Predictive Route Weather (High Risk)

**Technical Uncertainty**: Can we predict weather along a multi-day hiking route, accounting for:
- Hiker pace variation
- Rest stops and camps
- Alternative route options
- Changing forecasts over trip duration

**Hypothesis Framework**:

| Hypothesis | Description | Success Criterion | Risk |
|------------|-------------|-------------------|------|
| H6.1 | Route-integrated forecast accuracy | ≥85% accuracy 72h ahead | High |
| H6.2 | Optimal departure time recommendation | User-validated improvement in trip success | Very High |
| H6.3 | Dynamic rerouting based on weather | Safe alternative identified in ≥90% of cases | Very High |

### 8.2 Phase 3: Ensemble Machine Learning Forecasting (Very High Risk)

**Technical Uncertainty**: Can machine learning improve forecast accuracy beyond ensemble averaging?

**Hypothesis Framework**:

| Hypothesis | Description | Success Criterion | Risk |
|------------|-------------|-------------------|------|
| H7.1 | ML ensemble outperforms weighted average | ≥10% RMSE reduction | High |
| H7.2 | Transfer learning across mountain ranges | Model trained on Tasmania improves NZ accuracy | Very High |
| H7.3 | Uncertainty quantification | Calibrated confidence intervals | High |

### 8.3 Phase 4: Predictive Safety Alerts (Very High Risk)

**Technical Uncertainty**: Can we predict dangerous conditions before they occur and proactively alert users?

**Hypothesis Framework**:

| Hypothesis | Description | Success Criterion | Risk |
|------------|-------------|-------------------|------|
| H8.1 | 6-hour danger prediction | ≥80% of dangerous conditions predicted | Very High |
| H8.2 | False positive management | <20% false positive rate | High |
| H8.3 | User response to proactive alerts | ≥70% take protective action | Medium |

### 8.4 Phase 5: Computer Vision Weather Verification (Very High Risk)

**Technical Uncertainty**: Can user-submitted photos verify or improve forecast accuracy?

**Hypothesis Framework**:

| Hypothesis | Description | Success Criterion | Risk |
|------------|-------------|-------------------|------|
| H9.1 | Cloud type classification from photos | ≥85% correct classification | High |
| H9.2 | Visibility estimation from photos | ±500m accuracy | Very High |
| H9.3 | Photo-based forecast correction | Measurable accuracy improvement | Very High |

### 8.5 Phase 6: Biometric-Weather Correlation (Speculative)

**Technical Uncertainty**: Can Apple Watch biometrics indicate weather-related distress before conscious awareness?

**Hypothesis Framework**:

| Hypothesis | Description | Success Criterion | Risk |
|------------|-------------|-------------------|------|
| H10.1 | Heart rate variability predicts cold stress | ≥70% detection before symptoms | Very High |
| H10.2 | Movement patterns indicate fatigue | ≥75% accuracy | Very High |
| H10.3 | Early warning improves outcomes | Measurable safety improvement | Very High |

---

## Appendix: Test Batteries

### A.1 SMS Service Test Battery (500 cases)

```
ID      Category                    Input                                   Expected Output
──────────────────────────────────────────────────────────────────────────────────────────────
T001    GPS Basic                   CAST -43.20,146.18                      12hr forecast returned
T002    GPS Altitude Adjust         CAST -43.20,146.18 (elev 1200m)         Temp adjusted for altitude
T003    GPS Boundary                CAST -43.99,145.01                      Correct cell mapping
T004    Camp Code                   CAST LAKEO                              Lake Oberon forecast
T005    Peak Code                   CAST FEDER                              Federation Peak forecast
...
T100    Altitude Edge               CAST at 1450m (max elevation)           Valid forecast or error
──────────────────────────────────────────────────────────────────────────────────────────────
T101    Cloud Base Clear            Humidity 40%, Temp 15°C                 CB > 2000m
T102    Cloud Base Overcast         Humidity 95%, Temp 8°C                  CB ~400-600m
T103    Cloud Base Inversion        Inversion conditions                    Appropriate handling
...
T175    Cloud Base Rain             During precipitation                    Valid estimate
──────────────────────────────────────────────────────────────────────────────────────────────
T176    Danger None                 Light wind, clear, warm                 No danger indicator
T177    Danger Wind                 Gusts 60km/h                            ! indicator
T178    Danger Ice                  Freezing level below peak               ! indicator
T179    Danger Visibility           Cloud base below peak                   ! indicator
T180    Danger Multiple             Wind + ice + visibility                 !!! indicator
...
T225    Danger TS                   CAPE 2500 J/kg                          TS! indicator
──────────────────────────────────────────────────────────────────────────────────────────────
[Continues to T500...]
```

### A.2 Natural Language Test Battery (500 cases)

```
ID      Category                    Input                                   Expected Command
──────────────────────────────────────────────────────────────────────────────────────────────
N001    Unambiguous                 "weather at lake oberon"                CAST LAKEO
N002    Unambiguous                 "forecast for high moor"                CAST HIGHM
N003    Unambiguous                 "7 day outlook"                         CAST7
...
N100    Unambiguous                 "what's the temp at federation peak"   CAST FEDER
──────────────────────────────────────────────────────────────────────────────────────────────
N101    Ambiguous Location          "the lake"                              CLARIFY or best match
N102    Ambiguous Location          "lake o"                                CAST LAKEO
N103    Ambiguous Location          "that camp near high moor"              CAST HIGHM or CLARIFY
N104    Ambiguous Location          "camp 3"                                Context-dependent
...
N200    Ambiguous Location          "summit"                                Route-dependent
──────────────────────────────────────────────────────────────────────────────────────────────
N201    Ambiguous Temporal          "later today"                           Next 6-12 hours
N202    Ambiguous Temporal          "tomorrow arvo"                         Tomorrow 12:00-18:00
N203    Ambiguous Temporal          "next few days"                         CAST7
N204    Ambiguous Temporal          "this weekend"                          Sat-Sun forecast
...
N275    Ambiguous Temporal          "when I get there"                      CLARIFY
──────────────────────────────────────────────────────────────────────────────────────────────
N276    Informal                    "whats the go at lakeo"                 CAST LAKEO
N277    Informal                    "reckon itll rain"                      Precipitation forecast
...
N325    Informal                    "she'll be right tomorrow?"             Tomorrow safety assessment
──────────────────────────────────────────────────────────────────────────────────────────────
N326    Multi-intent                "weather and safety for tomorrow"       CAST24 + danger assessment
N327    Multi-intent                "rain at camp and wind at summit"       Two location forecasts
...
N375    Multi-intent                "compare today and tomorrow"            Two time period comparison
──────────────────────────────────────────────────────────────────────────────────────────────
N376    Context-dependent           [After LAKEO query] "what about wind"   Wind at LAKEO
N377    Context-dependent           [After LAKEO query] "and tomorrow"      CAST24 LAKEO
...
N425    Context-dependent           [30 min gap] "same place, next week"    CAST7 previous location
──────────────────────────────────────────────────────────────────────────────────────────────
N426    Safety-critical             "is it safe to summit"                  Safety assessment + caveats
N427    Safety-critical             "should I turn back"                    Current conditions + advisory
N428    Safety-critical             "can I cross the range"                 Route danger assessment
...
N475    Safety-critical             "will I die if I go out"                De-escalation + conditions
──────────────────────────────────────────────────────────────────────────────────────────────
N476    Negation/Conditional        "just wind, not rain"                   Wind-only forecast
N477    Negation/Conditional        "if it clears tomorrow"                 Conditional assessment
...
N500    Negation/Conditional        "unless there's lightning"              Thunderstorm check
```

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-02 | [Name] | Initial documentation |

---

## Certification

I certify that the activities described in this document:

1. Involve systematic, investigative and experimental activities
2. Are conducted for the purpose of generating new knowledge
3. Involve technical uncertainty that could not be resolved by a competent professional in advance
4. Follow a systematic methodology of hypothesis, experimentation, and evaluation

Signed: _______________________

Name: _______________________

Position: _______________________

Date: _______________________

---

*This document is prepared in accordance with the requirements of the Australian R&D Tax Incentive program as administered by AusIndustry and the Australian Taxation Office.*
