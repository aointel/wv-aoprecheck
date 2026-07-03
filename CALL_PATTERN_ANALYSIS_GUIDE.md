# Call Pattern Analysis Guide

## What This Script Does

The `analyze-call-patterns.ts` script:

1. **Fetches call data** from three sources:
   - `agent_dial_metrics` (primary - has call_duration, disposition, timestamps)
   - `call_log` (secondary - has duration_seconds, disposition)
   - `twilio_call_logs` (tertiary - has call_duration, call_status)

2. **Calculates statistics** for each agent:
   - Mean and standard deviation of call durations
   - Percentiles (25th, 50th, 75th, 95th)
   - Threshold gaming detection (calls at exactly 45s, 120s, 300s)
   - Disposition timing (time between dial and disposition)
   - Call duration variation (consistency check)

3. **Generates recommendations** based on:
   - Your actual data patterns
   - Industry standards
   - Statistical analysis

## Industry Standards (Research Findings)

### Average Call Duration
- **Insurance Sales**: ~516 seconds (8.6 minutes)
- **Service Calls**: ~426 seconds (7.1 minutes)
- **Industry Average**: Has nearly doubled from 220s (2004) to 426s (2022)

### Anomaly Detection Methods
- **Standard Deviation Method**: Most common, uses mean ± (num_sd × std dev)
- **Typical Threshold**: 1-2 standard deviations from mean
- **Sensitivity**: Lower values = more anomalies detected, higher = fewer false positives

### Fraud Detection Patterns
- **Real-time monitoring**: Modern systems analyze calls in real-time
- **Pattern recognition**: Look for consistent suspicious patterns, not just outliers
- **Machine Learning**: Uses supervised/unsupervised learning to identify anomalies
- **Accuracy**: Top systems achieve 90%+ accuracy with 22% more fraud detection

## What Normal Companies Do

### 1. **Statistical Baseline Establishment**
- Calculate mean and standard deviation from 30-90 days of historical data
- Establish "normal" ranges for each agent based on their own history
- Compare agents against their own baseline, not just overall average

### 2. **Pattern-Based Detection (Not Just Outliers)**
- Detect **consistent patterns** of gaming (e.g., all calls at exactly 45s)
- Look for **lack of natural variation** (real conversations have variation)
- Monitor **disposition timing** (too fast = suspicious)
- Track **threshold gaming** (calls exactly at system trigger points)

### 3. **Progressive Enforcement**
- **1st violation**: Warning only (log for review)
- **2nd violation**: Short timeout (10 minutes)
- **3rd violation**: Medium timeout (1 hour)
- **4th violation**: Long timeout (24 hours)

### 4. **Multi-Metric Analysis**
- Don't rely on single metric
- Combine: call duration + disposition timing + variation + pattern matching
- Use **ensemble detection** (multiple checks, not just one)

## Running the Analysis

### Basic Usage
```bash
npm run analyze:call-patterns
```

### With Options
```bash
# Analyze last 60 days
npm run analyze:call-patterns -- --days=60

# Analyze specific agent
npm run analyze:call-patterns -- --agent=agent@example.com

# Combine options
npm run analyze:call-patterns -- --days=90 --agent=agent@example.com
```

### Direct Execution
```bash
tsx scripts/analyze-call-patterns.ts --days=30
```

## What the Output Shows

1. **Overall Statistics**
   - Total calls analyzed
   - Average call duration
   - Standard deviation
   - Percentiles

2. **Threshold Gaming Analysis**
   - Percentage of calls at exactly 45s, 120s, 300s
   - Comparison to average

3. **Variation Analysis**
   - Standard deviation of call durations
   - Detection of suspiciously consistent patterns

4. **Disposition Timing Analysis**
   - Average time between dial and disposition
   - Detection of too-fast dispositions

5. **Recommended Thresholds**
   - Based on YOUR data
   - Industry-adjusted recommendations
   - Specific thresholds for each detection type

6. **Suspicious Agents List**
   - Agents with patterns that exceed thresholds
   - Specific metrics showing why they're flagged

## Next Steps After Analysis

1. **Review the recommendations** - The script will suggest thresholds based on your data
2. **Adjust thresholds** - Fine-tune based on your business needs
3. **Implement detection** - Use the recommended thresholds in the anomaly detector
4. **Monitor results** - Run analysis weekly to adjust thresholds as patterns change
5. **Review flagged agents** - Manually review agents with suspicious patterns

## Example Output Interpretation

```
📊 OVERALL STATISTICS:
   Average Call Duration: 180.5s (3.0 min)
   Standard Deviation: 45.2s
   Average Threshold Gaming: 8.3%

🎯 RECOMMENDED THRESHOLDS:
   1. THRESHOLD GAMING DETECTION:
      • Flag if >12.5% of calls are at thresholds
      • (Current average: 8.3%, so 1.5x = 12.5%)

   2. CALL DURATION VARIATION:
      • Flag if std dev < 22.6s (too consistent)
      • (Current average: 45.2s, so 50% = 22.6s)

   3. DISPOSITION TIMING:
      • Flag if >20% of dispositions applied < 15s after dial
```

This means:
- If an agent has >12.5% of calls at exactly 45s/120s/300s → suspicious
- If an agent's call durations have <22.6s variation → suspicious (too consistent)
- If an agent applies >20% of dispositions within 15s → suspicious (too fast)

## Industry Best Practices

1. **Trust but Verify**: Allow agents to work, but log and review anomalies
2. **Pattern Recognition**: Focus on consistent patterns, not one-off outliers
3. **Agent-Specific Baselines**: Compare agents to their own history, not just overall average
4. **Progressive Enforcement**: Start with warnings, escalate to timeouts
5. **Regular Review**: Run analysis weekly/monthly to adjust thresholds
6. **Human Review**: Always have humans review flagged patterns before taking action
