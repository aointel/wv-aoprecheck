/**
 * AOI Hourly Activity Card Renderer - PIXEL PERFECT MATCH
 * Built piece-by-piece to match the reference image exactly
 * Quality over speed - every detail matters
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { supabaseAdmin } from '../supabase';
import { buildActivityCardPayload } from '../activity-card-report-service';

// Types
export type ActivityCardAgent = {
  rank: number;
  rankChange?: number;
  name: string;
  dials: number;
  dialsPct: number;
  dialsTrend: 'up' | 'down';
  reach: number;
  reachPct: number;
  reachTrend: 'up' | 'down';
  booked: number;
  bookedPct: number;
  bookedTrend: 'up' | 'down';
  instant: number;
  instantPct: number;
  instantTrend: 'up' | 'down';
  connects: number;
  connectsPct: number;
  connectsTrend: 'up' | 'down';
  missedCalls: number;
  missedCallsPct: number;
  missedCallsTrend: 'up' | 'down';
  aoiUsage: number;
  aoiUsagePct: number;
  aoiUsageTrend: 'up' | 'down';
  photoUrl?: string;
  isLive?: boolean;
};

export type ActivityCardPayload = {
  generatedAt: string;
  agencyName: string;
  totals: {
    activeAgents: number;
    totalAgents?: number;
    dials: number;
    dialsPct: number;
    dialsTrend: 'up' | 'down';
    reach: number;
    reachPct: number;
    reachTrend: 'up' | 'down';
    booked: number;
    bookedPct: number;
    bookedTrend: 'up' | 'down';
    instant: number;
    instantPct: number;
    instantTrend: 'up' | 'down';
    connects: number;
    connectsPct: number;
    connectsTrend: 'up' | 'down';
    missedCalls: number;
    missedCallsPct: number;
    missedCallsTrend: 'up' | 'down';
    aoiUsage: number;
    aoiUsagePct: number;
    aoiUsageTrend: 'up' | 'down';
    deltaPct: number;
    weeklyProductionEst?: number;
    previousWeeksALP?: number;
  };
  chart: {
    labels: string[];
    series: number[];
  };
  agents: ActivityCardAgent[];
};

/**
 * Generate HTML template - PIXEL PERFECT match to reference image
 * Built section by section with exact measurements
 */
export function generateHTML(payload: ActivityCardPayload): string {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AOI Activity Card</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    /* ============================================
       SECTION 1: BASE BACKGROUND & GLOBE EFFECTS
       ============================================ */
    html {
      width: 100%;
      min-height: 100vh;
      overflow-x: hidden;
      overflow-y: auto;
    }
    body {
      width: 100%;
      min-height: 100vh;
      /* Background image from template - will be set dynamically */
      background-image: url('__BACKGROUND_IMAGE_URL__');
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      /* Fallback gradient if image fails to load */
      background-color: #0A0E27;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #FFFFFF;
      overflow-x: hidden;
      overflow-y: auto;
      position: relative;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 0;
      margin: 0;
    }
    
    /* Fallback gradient overlay - reduced opacity by 15% to show background more */
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(180deg, 
        #071126 0%, 
        #111f3d 36%, 
        #1a1e42 62%, 
        #101936 100%
      );
      pointer-events: none;
      z-index: -1;
      opacity: __GRADIENT_OPACITY__;
    }
    
    /* Subtle glow overlay - reduced opacity by 15% to show background more */
    body::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        radial-gradient(circle 560px at 18% 10%, rgba(37, 99, 235, 0.15) 0%, transparent 52%),
        radial-gradient(circle 520px at 80% 18%, rgba(34, 211, 238, 0.1) 0%, transparent 50%),
        radial-gradient(circle 680px at 72% 84%, rgba(139, 92, 246, 0.1) 0%, transparent 55%);
      pointer-events: none;
      z-index: 0;
      opacity: __GLOW_OPACITY__;
    }
    
    /* ============================================
       SECTION 2: MAIN CONTAINER
       ============================================ */
    .card-container {
      width: 100%;
      max-width: 1290px;
      min-height: 100vh;
      position: relative;
      padding: 40px 38px;
      z-index: 1;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
    }
    
    @media (max-width: 430px) {
      .card-container {
        padding: 20px 16px;
      }
    }
    
    /* ============================================
       SECTION 3: HEADER (Logo + Live Status)
       ============================================ */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 28px;
      padding-top: 8px;
      position: sticky;
      top: 0;
      background: #081424;
      z-index: 10;
      padding-bottom: 8px;
    }
    
    @media (max-width: 430px) {
      .header {
        margin-bottom: 16px;
        padding-top: 4px;
        padding-bottom: 4px;
      }
    }
    
    .logo-section {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .logo {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%);
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11.9px;
      font-weight: bold;
      color: #FFFFFF;
      box-shadow: 
        0 2px 12px rgba(20, 184, 166, 0.7),
        0 0 20px rgba(139, 92, 246, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }
    
    @media (max-width: 430px) {
      .logo {
        width: 32px;
        height: 32px;
        font-size: 18px;
        border-radius: 7px;
      }
    }
    
    .agency-name {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.4px;
      color: #FFFFFF;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
    }
    
    @media (max-width: 430px) {
      .agency-name {
        font-size: 12px;
      }
    }
    
    .time-live {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13.5px;
      color: #10B981;
      font-weight: 600;
      text-shadow: 0 1px 4px rgba(16, 185, 129, 0.4);
    }
    
    @media (max-width: 430px) {
      .time-live {
        font-size: 9px;
        gap: 4px;
      }
    }
    
    .live-dot-header {
      width: 7px;
      height: 7px;
      background: #10B981;
      border-radius: 50%;
      box-shadow: 
        0 0 8px rgba(16, 185, 129, 1),
        0 0 16px rgba(16, 185, 129, 0.8);
      animation: pulse 2s infinite;
    }
    
    @media (max-width: 430px) {
      .live-dot-header {
        width: 5px;
        height: 5px;
      }
    }
    
    /* ============================================
       SECTION 4: TITLE BLOCK
       ============================================ */
    .main-title {
      font-size: 31px;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 6px;
      letter-spacing: 1px;
      text-shadow: 0 3px 14px rgba(0, 0, 0, 0.72);
      line-height: 1.15;
    }
    
    @media (max-width: 430px) {
      .main-title {
        font-size: 32px;
        margin-bottom: 4px;
      }
    }
    
    .subtitle {
      font-size: 24px;
      color: #94A3B8;
      margin-bottom: 24px;
      font-weight: 600;
      letter-spacing: 0.4px;
      line-height: 1.4;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
    }
    
    @media (max-width: 430px) {
      .subtitle {
        font-size: 8px;
        margin-bottom: 16px;
      }
    }
    
    
    /* ============================================
       SECTION 6: KPI TILES (7 Metrics)
       ============================================ */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;
      margin-bottom: 16px;
      position: sticky;
      top: 80px;
      background: #081424;
      z-index: 10;
      padding-top: 10px;
      padding-bottom: 10px;
    }
    
    @media (max-width: 430px) {
      .kpi-grid {
        top: 60px;
      }
    }
    
    @media (max-width: 430px) {
      .kpi-grid {
        gap: 6px;
        margin-bottom: 16px;
      }
    }
    
    .kpi-tile {
      background: rgba(30, 41, 59, 0.65);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 13px;
      padding: 16px 10px 14px;
      backdrop-filter: blur(18px);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-shadow: 
        0 4px 14px rgba(0, 0, 0, 0.28),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      position: relative;
      transition: all 0.25s ease;
    }
    
    @media (max-width: 430px) {
      .kpi-tile {
        padding: 12px 8px 10px;
        border-radius: 10px;
      }
    }
    
    /* Bottom accent glow line on each tile */
    .kpi-tile::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, 
        transparent 0%,
        rgba(20, 184, 166, 0.4) 20%,
        rgba(139, 92, 246, 0.4) 80%,
        transparent 100%
      );
      border-radius: 0 0 13px 13px;
    }
    
    .kpi-icon {
      width: 19.375px;
      height: 19.375px;
      margin-bottom: 11.25px;
      color: #7DD3FC;
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.45));
    }
    
    @media (max-width: 430px) {
      .kpi-icon {
        width: 15px;
        height: 15px;
        margin-bottom: 7.5px;
      }
    }

    .kpi-icon svg {
      width: 16.25px;
      height: 16.25px;
      stroke: currentColor;
      stroke-width: 1.8;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    
    @media (max-width: 430px) {
      .kpi-icon svg {
        width: 12.5px;
        height: 12.5px;
      }
    }
    
    .kpi-label {
      font-size: 17.875px;
      color: #94A3B8;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 7.5px;
      font-weight: 600;
    }
    
    @media (max-width: 430px) {
      .kpi-label {
        font-size: 6.875px;
        margin-bottom: 5px;
      }
    }
    
    .kpi-value {
      font-size: 41.775px;
      font-weight: 700;
      color: #FFFFFF;
      line-height: 1;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55);
      letter-spacing: -0.5px;
      margin-bottom: 2px;
    }
    
    @media (max-width: 430px) {
      .kpi-value {
        font-size: 12px;
      }
    }
    
    .kpi-value.dials {
      color: #14B8A6;
      text-shadow: 
        0 2px 12px rgba(20, 184, 166, 0.6),
        0 0 20px rgba(20, 184, 166, 0.3);
    }
    
    .kpi-value.reach {
      color: #14B8A6;
      text-shadow: 
        0 2px 12px rgba(20, 184, 166, 0.6),
        0 0 20px rgba(20, 184, 166, 0.3);
    }
    
    .kpi-value.booked {
      color: #8B5CF6;
      text-shadow: 
        0 2px 12px rgba(139, 92, 246, 0.6),
        0 0 20px rgba(139, 92, 246, 0.3);
    }
    
    .kpi-value.instant {
      color: #F59E0B;
      text-shadow: 
        0 2px 12px rgba(245, 158, 11, 0.6),
        0 0 20px rgba(245, 158, 11, 0.3);
    }
    
    .kpi-value.connects {
      color: #3B82F6;
      text-shadow: 
        0 2px 12px rgba(59, 130, 246, 0.6),
        0 0 20px rgba(59, 130, 246, 0.3);
    }

    .kpi-value.missed {
      color: #EF4444;
      text-shadow:
        0 2px 12px rgba(239, 68, 68, 0.65),
        0 0 20px rgba(239, 68, 68, 0.35);
    }
    
    .kpi-value.aoi {
      color: #EC4899;
      text-shadow: 
        0 2px 12px rgba(236, 72, 153, 0.6),
        0 0 20px rgba(236, 72, 153, 0.3);
    }
    
    /* ============================================
       SECTION 7: TOP AGENTS LEADERBOARD
       ============================================ */
    .leaderboard {
      background: rgba(30, 41, 59, 0.65);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 13px;
      padding: 18px 20px;
      backdrop-filter: blur(18px);
      box-shadow: 
        0 4px 16px rgba(0, 0, 0, 0.28),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
      margin-bottom: 16px;
    }
    
    @media (max-width: 430px) {
      .leaderboard {
        padding: 12px 14px;
        border-radius: 10px;
        margin-bottom: 12px;
      }
    }
    
    #leaderboard-all-rows {
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      touch-action: pan-y;
      flex: 1;
      min-height: 0;
    }
    
    .leaderboard-title {
      font-size: 24px;
      color: #FFFFFF;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 1.6px;
      font-weight: 800;
      text-shadow: 0 3px 12px rgba(0, 0, 0, 0.62);
      line-height: 1.3;
    }
    
    @media (max-width: 430px) {
      .leaderboard-title {
        font-size: 14px;
        margin-bottom: 12px;
      }
    }
    
    .leaderboard-section {
      margin-bottom: 4px;
      padding-left: 0;
      padding-right: 0;
      max-height: 400px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    @media (max-width: 430px) {
      .leaderboard-section {
        margin-bottom: 3px;
        padding-left: 0;
        padding-right: 0;
        max-height: 280px;
      }
    }
    
    .leaderboard-section-title {
      font-size: 15px;
      color: #14B8A6;
      margin-bottom: 14px;
      text-transform: uppercase;
      letter-spacing: 1.45px;
      font-weight: 800;
      text-shadow: 0 2px 10px rgba(20, 184, 166, 0.5);
      padding-left: 2px;
      line-height: 1.3;
    }
    
    @media (max-width: 430px) {
      .leaderboard-section-title {
        font-size: 10px;
        margin-bottom: 10px;
      }
    }
    
    .leaderboard-header {
      display: grid;
      grid-template-columns: 40px 46px 50px 35px 1fr 1fr 1fr 1fr 1fr;
      gap: 4px;
      padding: 6px 4px 6px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.32);
      font-size: 8px;
      color: #D1E3FF;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      font-weight: 800;
      margin-bottom: 6px;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    }
    
    @media (max-width: 430px) {
      .leaderboard-header {
        grid-template-columns: 30px 34.5px 40px 28px 1fr 1fr 1fr 1fr 1fr;
        gap: 3px;
        font-size: 6px;
        padding: 5px 3px 5px 0;
        margin-bottom: 5px;
      }
    }

    .metric-icon-head {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9DD7FF;
      opacity: 0.95;
      filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.4));
      width: 100%;
    }

    .metric-icon-head.missed {
      color: #F87171;
      filter: drop-shadow(0 1px 5px rgba(239, 68, 68, 0.45));
    }

    .metric-icon-head svg {
      width: 14.3px;
      height: 14.3px;
      stroke: currentColor;
      stroke-width: 2;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    
    @media (max-width: 430px) {
      .metric-icon-head svg {
        width: 11px;
        height: 11px;
      }
    }

    .change-col-head {
      text-align: left;
      transform: translateX(-8px);
    }
    
    .leaderboard-row {
      display: grid;
      grid-template-columns: 40px 46px 50px 35px 1fr 1fr 1fr 1fr 1fr;
      grid-template-rows: auto 2px;
      gap: 4px;
      align-items: center;
      padding: 6px 4px 6px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.25);
      position: relative;
      border-radius: 8px;
      margin: 2px 0;
      background: linear-gradient(90deg, 
        rgba(20, 184, 166, 0.04) 0%,
        rgba(139, 92, 246, 0.06) 100%
      );
      transition: all 0.25s ease;
    }
    
    @media (max-width: 430px) {
      .leaderboard-row {
        grid-template-columns: 30px 34.5px 40px 28px 1fr 1fr 1fr 1fr 1fr;
        grid-template-rows: auto 1.5px;
        gap: 3px;
        padding: 5px 3px 5px 0;
        border-radius: 6px;
        margin: 2px 0;
      }
    }
    .rank,
    .avatar,
    .agent-name-section,
    .rank-change,
    .stat-value {
      grid-row: 1;
    }

    .row-progress {
      grid-column: 5 / 10;
      grid-row: 2;
      height: 2px;
      border-radius: 99px;
      background: rgba(148, 163, 184, 0.22);
      overflow: hidden;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.35);
    }
    
    @media (max-width: 430px) {
      .row-progress {
        height: 1.5px;
      }
    }

    .row-progress-fill {
      height: 100%;
      width: 0%;
      border-radius: 99px;
      background: linear-gradient(90deg, #1D9BF0 0%, #22D3EE 48%, #8B5CF6 100%);
      box-shadow: 0 0 10px rgba(34, 211, 238, 0.45);
    }

    
    .leaderboard-row:last-child {
      border-bottom: none;
    }
    
    /* Left accent line on hover/active rows */
    .leaderboard-row::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: linear-gradient(180deg, #14B8A6 0%, #8B5CF6 100%);
      border-radius: 8px 0 0 8px;
      opacity: 0.4;
    }
    
    .rank {
      font-size: 16.5px;
      font-weight: 800;
      text-align: center;
      color: #94A3B8;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
      letter-spacing: -0.2px;
      line-height: 1;
    }
    
    @media (max-width: 430px) {
      .rank {
        font-size: 10px;
      }
    }
    
    .rank-1 {
      color: #FCD34D;
      filter: drop-shadow(0 0 10px rgba(252, 211, 77, 0.75));
      font-size: 37.4px;
      text-shadow: 0 2px 8px rgba(252, 211, 77, 0.65);
    }
    
    @media (max-width: 430px) {
      .rank-1 {
        font-size: 12px;
      }
    }
    
    .avatar {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      color: #FFFFFF;
      overflow: hidden;
      border: 2px solid rgba(255, 255, 255, 0.42);
      box-shadow: 
        0 4px 14px rgba(0, 0, 0, 0.5),
        0 0 18px rgba(20, 184, 166, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.22);
      margin-left: 4px;
    }
    
    @media (max-width: 430px) {
      .avatar {
        width: 34.5px;
        height: 34.5px;
        font-size: 9.2px;
        margin-left: 2px;
      }
    }
    
    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .agent-name-section {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5px;
      padding-left: 4px;
      min-width: 0;
      max-width: 70px;
      overflow: hidden;
    }
    
    @media (max-width: 430px) {
      .agent-name-section {
        padding-left: 3px;
        max-width: 60px;
      }
    }
    
    .agent-first,
    .agent-last {
      font-size: 5px;
      font-weight: 700;
      color: #FFFFFF;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.62);
      letter-spacing: 0.2px;
      line-height: 1.1;
      white-space: nowrap;
      word-break: keep-all;
      text-overflow: ellipsis;
      overflow: hidden;
    }
    
    @media (max-width: 430px) {
      .agent-first,
      .agent-last {
        font-size: 4px;
      }
    }

    .agent-last {
      font-weight: 800;
      color: #E2E8F0;
    }
    
    .live-text {
      font-size: 15.4px;
      color: #10B981;
      font-weight: 600;
      text-shadow: 0 1px 4px rgba(16, 185, 129, 0.5);
      letter-spacing: 0.5px;
    }
    
    .stat-value {
      font-size: 38.8125px;
      color: #E2E8F0;
      text-align: center;
      font-weight: 700;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
      letter-spacing: -0.3px;
      line-height: 1;
      padding-right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    
    .stat-value:nth-child(4) {
      padding-left: 8px;
    }
    
    @media (max-width: 430px) {
      .stat-value {
        font-size: 24.84px;
        gap: 3px;
      }
      .stat-value:nth-child(4) {
        padding-left: 6px;
      }
    }

    .stat-value:not(:last-child) {
      border-right: 1px dashed rgba(148, 163, 184, 0.35);
    }
    
    .stat-main {
      font-size: 15.625px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    
    @media (max-width: 430px) {
      .stat-main {
        font-size: 8px;
      }
    }

    .stat-main.missed {
      color: #F87171;
      text-shadow:
        0 1px 8px rgba(239, 68, 68, 0.45),
        0 0 14px rgba(239, 68, 68, 0.3);
    }

    .stat-main.usage {
      font-size: 10.3px;
      letter-spacing: 0;
    }
    
    @media (max-width: 430px) {
      .stat-main.usage {
        font-size: 7px;
      }
    }

    .rank-change {
      text-align: center;
      font-size: 14.6px;
      font-weight: 800;
      letter-spacing: -0.2px;
      line-height: 1;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
    }
    
    @media (max-width: 430px) {
      .rank-change {
        font-size: 12px;
      }
    }

    .rank-change.up {
      color: #10B981;
      filter: drop-shadow(0 0 7px rgba(16, 185, 129, 0.5));
    }

    .rank-change.down {
      color: #EF4444;
      filter: drop-shadow(0 0 7px rgba(239, 68, 68, 0.5));
    }

    .rank-change.flat {
      color: #94A3B8;
    }
    
    .live-dot {
      width: 6px;
      height: 6px;
      background: #10B981;
      border-radius: 50%;
      box-shadow: 
        0 0 8px rgba(16, 185, 129, 1),
        0 0 14px rgba(16, 185, 129, 0.7);
      animation: pulse 2s infinite;
    }
    
    .live-text {
      font-size: 15.4px;
      color: #10B981;
      font-weight: 600;
      text-shadow: 0 1px 4px rgba(16, 185, 129, 0.5);
      letter-spacing: 0.5px;
      line-height: 1.2;
    }
    
    /* ============================================
       SECTION 8: EST WEEKLY PRODUCTION PANEL
       ============================================ */
    .goal-section {
      margin-top: 4px;
      padding: 34px 28px;
      background: linear-gradient(120deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%);
      border: 1px solid rgba(56, 189, 248, 0.28);
      border-radius: 16px;
      backdrop-filter: blur(18px);
      position: sticky;
      bottom: 0;
      z-index: 10;
      box-shadow: 
        0 8px 24px rgba(0, 0, 0, 0.36),
        0 0 28px rgba(34, 211, 238, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }
    
    @media (max-width: 430px) {
      .goal-section {
        margin-top: 3px;
        padding: 20px 16px;
        border-radius: 12px;
      }
    }
    
    .goal-label {
      font-size: 8.5px;
      color: #7DD3FC;
      font-weight: 700;
      letter-spacing: 0.7px;
      text-transform: uppercase;
      text-shadow: 0 1px 8px rgba(34, 211, 238, 0.35);
    }
    
    @media (max-width: 430px) {
      .goal-label {
        font-size: 7px;
      }
    }
    
    .goal-percent {
      font-size: 33.15px;
      color: #FFFFFF;
      font-weight: 800;
      letter-spacing: -1px;
      line-height: 1;
      text-shadow:
        0 2px 14px rgba(56, 189, 248, 0.38),
        0 2px 8px rgba(0, 0, 0, 0.55);
      text-align: right;
      margin-left: auto;
    }
    
    @media (max-width: 430px) {
      .goal-percent {
        font-size: 23.4px;
      }
    }
    
    .goal-bar {
      width: 100%;
      height: 14px;
      background: rgba(148, 163, 184, 0.24);
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 18px;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    
    @media (max-width: 430px) {
      .goal-bar {
        height: 10px;
        margin-bottom: 12px;
      }
    }
    
    .goal-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #22D3EE 0%, #3B82F6 55%, #8B5CF6 100%);
      border-radius: 6px;
      transition: width 0.5s;
      box-shadow: 
        0 0 14px rgba(56, 189, 248, 0.55),
        0 0 22px rgba(139, 92, 246, 0.42);
    }
    
    .goal-target {
      font-size: 13.325px;
      color: #E2E8F0;
      text-align: left;
      font-weight: 700;
      letter-spacing: 0.2px;
    }
    
    @media (max-width: 430px) {
      .goal-target {
        font-size: 10.4px;
      }
    }

    .goal-change {
      font-size: 13.325px;
      font-weight: 800;
      letter-spacing: 0.2px;
      text-shadow: 0 1px 7px rgba(0, 0, 0, 0.45);
      text-align: left;
      margin-left: 0;
    }
    
    @media (max-width: 430px) {
      .goal-change {
        font-size: 10.4px;
      }
    }

    .goal-change.up {
      color: #10B981;
      filter: drop-shadow(0 0 7px rgba(16, 185, 129, 0.5));
    }

    .goal-change.down {
      color: #EF4444;
      filter: drop-shadow(0 0 7px rgba(239, 68, 68, 0.5));
    }

    .goal-top-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 18px;
    }

    .goal-bottom-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-top: 12px;
    }
    
    /* ============================================
       SECTION 9: FOOTER
       ============================================ */
    .footer {
      margin-top: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 15px;
      border-top: 1px solid rgba(148, 163, 184, 0.2);
    }
    
    .footer-logo {
      font-size: 9.9px;
      font-weight: 600;
      color: #94A3B8;
      letter-spacing: 0.2px;
    }
    
    .footer-status {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 7.15px;
      color: #10B981;
      font-weight: 500;
    }
    
    .footer-dot {
      width: 5px;
      height: 5px;
      background: #10B981;
      border-radius: 50%;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
    }
    
    /* ============================================
       ANIMATIONS - ELECTRIC & ANIMATED
       ============================================ */
    @keyframes pulse {
      0%, 100% { 
        opacity: 1; 
        transform: scale(1);
      }
      50% { 
        opacity: 0.65; 
        transform: scale(1.1);
      }
    }
    
    @keyframes electricGlow {
      0%, 100% {
        text-shadow: 
          0 4px 20px rgba(16, 185, 129, 0.9),
          0 0 40px rgba(16, 185, 129, 0.6),
          0 0 60px rgba(16, 185, 129, 0.3);
      }
      50% {
        text-shadow: 
          0 4px 30px rgba(16, 185, 129, 1),
          0 0 60px rgba(16, 185, 129, 0.8),
          0 0 90px rgba(16, 185, 129, 0.5);
      }
    }
    
    @keyframes avatarGlow {
      0%, 100% {
        box-shadow: 
          0 4px 20px rgba(0, 0, 0, 0.6),
          0 0 30px rgba(20, 184, 166, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.3);
      }
      50% {
        box-shadow: 
          0 4px 25px rgba(0, 0, 0, 0.7),
          0 0 45px rgba(20, 184, 166, 0.7),
          0 0 60px rgba(139, 92, 246, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.4);
      }
    }
    
    @keyframes goldPulse {
      0%, 100% {
        filter: drop-shadow(0 0 12px rgba(252, 211, 77, 1));
      }
      50% {
        filter: drop-shadow(0 0 20px rgba(252, 211, 77, 1));
      }
    }
    
    @keyframes rowPulse {
      0%, 100% {
        background: linear-gradient(90deg, 
          rgba(20, 184, 166, 0.08) 0%,
          rgba(139, 92, 246, 0.08) 100%
        );
      }
      50% {
        background: linear-gradient(90deg, 
          rgba(20, 184, 166, 0.12) 0%,
          rgba(139, 92, 246, 0.12) 100%
        );
      }
    }
    
    @keyframes tileFloat {
      0%, 100% {
        transform: translateY(0);
        box-shadow: 
          0 4px 18px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.12);
      }
      50% {
        transform: translateY(-3px);
        box-shadow: 
          0 8px 25px rgba(0, 0, 0, 0.4),
          0 0 20px rgba(20, 184, 166, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.15);
      }
    }
  </style>
</head>
<body>
  <div class="card-container" id="card-root">
    <!-- SECTION 3: Header -->
    <div class="header">
      <div class="logo-section">
        <div class="logo">AO</div>
        <div class="agency-name">AO INTELLIGENCE</div>
      </div>
      <div class="time-live">
        <span class="live-dot-header"></span>
        <span id="time-display">1:00 PM</span>
      </div>
    </div>
    
    <!-- SECTION 6: KPI Tiles -->
    <div class="kpi-grid">
      <div class="kpi-tile">
        <div class="kpi-icon"><svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="2.3"/><circle cx="16" cy="8" r="2.3"/><path d="M3.5 18c0-2.9 2.1-4.5 4.5-4.5s4.5 1.6 4.5 4.5"/><path d="M11.5 18c0-2.9 2.1-4.5 4.5-4.5s4.5 1.6 4.5 4.5"/></svg></div>
        <div class="kpi-value" id="kpi-agents">0/30</div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M6 3h4l2 5-2 2a17 17 0 0 0 4 4l2-2 5 2v4c0 1-1 2-2 2A16 16 0 0 1 4 5c0-1 1-2 2-2z"/></svg></div>
        <div class="kpi-value dials" id="kpi-dials">
          <span id="kpi-dials-number">0</span>
        </div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M2 12l5-5 5 5-5 5-5-5z"/><path d="M12 12l5-5 5 5-5 5-5-5z"/></svg></div>
        <div class="kpi-value reach" id="kpi-reach">
          <span id="kpi-reach-number">0</span>
        </div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8 15l2.5 2.5L16 12"/></svg></div>
        <div class="kpi-value booked" id="kpi-booked">
          <span id="kpi-booked-number">0</span>
        </div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><circle cx="12" cy="12" r="2.5"/></svg></div>
        <div class="kpi-value instant" id="kpi-instant">
          <span id="kpi-instant-number">0</span>
        </div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 3l-4 4 4 4"/><path d="M19 17H5"/><path d="M15 13l4 4-4 4"/></svg></div>
        <div class="kpi-value connects" id="kpi-connects">
          <span id="kpi-connects-number">0</span>
        </div>
      </div>
    </div>
    
    <!-- SECTION 7: Agency Performance Leaderboard -->
    <div class="leaderboard">
      <div class="leaderboard-section">
        <div class="leaderboard-header">
          <div></div>
          <div></div>
          <div class="metric-icon-head" title="Change"><svg viewBox="0 0 24 24"><text x="12" y="16" font-size="28" font-weight="bold" text-anchor="middle" fill="currentColor">%</text></svg></div>
          <div class="metric-icon-head" title="Dials"><svg viewBox="0 0 24 24"><path d="M6 3h4l2 5-2 2a17 17 0 0 0 4 4l2-2 5 2v4c0 1-1 2-2 2A16 16 0 0 1 4 5c0-1 1-2 2-2z"/></svg></div>
          <div class="metric-icon-head" title="Reach"><svg viewBox="0 0 24 24"><path d="M2 12l5-5 5 5-5 5-5-5z"/><path d="M12 12l5-5 5 5-5 5-5-5z"/></svg></div>
          <div class="metric-icon-head" title="Booked"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8 15l2.5 2.5L16 12"/></svg></div>
          <div class="metric-icon-head" title="Instant"><svg viewBox="0 0 24 24"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><circle cx="12" cy="12" r="2.5"/></svg></div>
          <div class="metric-icon-head" title="Connects"><svg viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 3l-4 4 4 4"/><path d="M19 17H5"/><path d="M15 13l4 4-4 4"/></svg></div>
          <div class="metric-icon-head" title="AOI Usage"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg></div>
        </div>
        <div id="leaderboard-all-rows"></div>
      </div>
    </div>
    
    <!-- SECTION 8: EST Weekly Production -->
    <div class="goal-section">
      <div class="goal-top-row">
        <div class="goal-label">EST Weekly Production</div>
        <div class="goal-percent" id="goal-percent">$0</div>
      </div>
      <div class="goal-bar">
        <div class="goal-bar-fill" id="goal-bar-fill" style="width: 0%;"></div>
      </div>
      <div class="goal-bottom-row">
        <div class="goal-target" id="goal-target">Previous Weeks ALP: $89,000</div>
        <div class="goal-change" id="goal-change">Change: +$0 (0.0%) ▲</div>
      </div>
    </div>
    
    <!-- SECTION 9: Footer -->
    <div class="footer">
      <div class="footer-logo">AO INTELLIGENCE</div>
      <div class="footer-status">
        <span class="footer-dot"></span>
        <span>Updated just now</span>
      </div>
    </div>
  </div>
  
  <script>
    const data = __CARD_DATA__;
    
    // Set time display
    const date = new Date(data.generatedAt);
    document.getElementById('time-display').textContent = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    
    // Set KPIs - numbers only, NO triangles, NO percentages
    const totalAgents = Number(data.totals.totalAgents || 30);
    document.getElementById('kpi-agents').textContent = \`\${data.totals.activeAgents}/\${totalAgents}\`;
    document.getElementById('kpi-dials-number').textContent = data.totals.dials.toLocaleString();
    document.getElementById('kpi-reach-number').textContent = data.totals.reach.toLocaleString();
    document.getElementById('kpi-booked-number').textContent = data.totals.booked.toLocaleString();
    document.getElementById('kpi-instant-number').textContent = data.totals.instant.toLocaleString();
    document.getElementById('kpi-connects-number').textContent = data.totals.connects.toLocaleString();
    const asCurrency = (value) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value || 0);

    const formatAoiUsage = (value) => {
      const totalMinutes = Math.max(0, Math.round(Number(value) || 0));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours > 0 && minutes === 0) return hours + 'H';
      if (hours > 0) return hours + 'H ' + minutes + 'M';
      return totalMinutes + 'M';
    };

    const statHTML = (value, extraClass = '') =>
      '<div class="stat-main ' + extraClass + '">' + value + '</div>';
    const formatAgentName = (name) => {
      const cleaned = String(name || '').replace(/\s+/g, ' ').trim();
      if (!cleaned) return '<div class="agent-first">Unknown</div>';

      const parts = cleaned.split(' ');
      const first = parts[0] || '';
      const last = parts.length > 1 ? parts[parts.length - 1] : '';

      if (!last || first.toLowerCase() === last.toLowerCase()) {
        return '<div class="agent-first">' + first + '</div>';
      }

      return '<div class="agent-first">' + first + '</div><div class="agent-last">' + last + '</div>';
    };
    const rankChangeHTML = (changeValue) => {
      const value = Number(changeValue || 0);
      if (value > 0) {
        return '<div class="rank-change up">+' + value + ' ▲</div>';
      }
      if (value < 0) {
        return '<div class="rank-change down">' + value + ' ▼</div>';
      }
      return '<div class="rank-change flat">0</div>';
    };

    // Bottom production hero section
    const weeklyProductionEst = Number(data.totals.weeklyProductionEst || Math.round(data.totals.booked * 220));
    const previousWeeksALP = Number(data.totals.previousWeeksALP || 89000);
    const weeklyProgress = Math.min(100, Math.max(8, Math.round((weeklyProductionEst / Math.max(previousWeeksALP, 1)) * 100)));
    const weeklyChange = weeklyProductionEst - previousWeeksALP;
    const weeklyChangePct = previousWeeksALP > 0 ? (weeklyChange / previousWeeksALP) * 100 : 0;
    const weeklyUp = weeklyChange >= 0;

    document.getElementById('goal-percent').textContent = asCurrency(weeklyProductionEst);
    document.getElementById('goal-bar-fill').style.width = weeklyProgress + '%';
    document.getElementById('goal-target').textContent = 'Previous Weeks ALP: ' + asCurrency(previousWeeksALP);
    const goalChangeEl = document.getElementById('goal-change');
    goalChangeEl.textContent = 'Change: ' + (weeklyUp ? '+' : '-') + asCurrency(Math.abs(weeklyChange)) + ' (' + (weeklyUp ? '+' : '-') + Math.abs(weeklyChangePct).toFixed(1) + '%) ' + (weeklyUp ? '▲' : '▼');
    goalChangeEl.className = 'goal-change ' + (weeklyUp ? 'up' : 'down');
    
    // Leaderboard - weighted performance ranking:
    // dials=1, reach=10, booked=40, connects=25, instant=80
    // Show ALL active agents, sorted by performance score
    const score = (a) => (a.dials * 1) + (a.reach * 10) + (a.booked * 40) + (a.connects * 25) + (a.instant * 80);
    const sortedAgents = [...data.agents].sort((a, b) => {
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      if (b.booked !== a.booked) return b.booked - a.booked;
      if (b.reach !== a.reach) return b.reach - a.reach;
      return b.dials - a.dials;
    });
    
    // Build all agent rows (with scrolling)
    const allRowsEl = document.getElementById('leaderboard-all-rows');
    sortedAgents.forEach(agent => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      
      const rankClass = agent.rank === 1 ? 'rank-1' : '';
      const initials = agent.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const rowProgress = Math.max(12, Math.min(100, Math.round(agent.aoiUsage)));
      // Use agent profile picture, fallback to deterministic initials avatar (not random).
      const demoPhotoUrl = agent.photoUrl || \`https://ui-avatars.com/api/?name=\${encodeURIComponent(agent.name)}&size=256&background=0f172a&color=e2e8f0&bold=true\`;
      
      row.innerHTML = \`
        <div class="rank \${rankClass}">#\${agent.rank}</div>
        <div class="avatar">
          <img src="\${demoPhotoUrl}" alt="\${agent.name}" onerror="this.parentElement.innerHTML='\${initials}'; this.parentElement.style.background='linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)';" />
        </div>
        \${rankChangeHTML(agent.rankChange)}
        <div class="stat-value">\${statHTML(agent.dials)}</div>
        <div class="stat-value">\${statHTML(agent.reach)}</div>
        <div class="stat-value">\${statHTML(agent.booked)}</div>
        <div class="stat-value">\${statHTML(agent.instant)}</div>
        <div class="stat-value">\${statHTML(agent.connects)}</div>
        <div class="stat-value">\${statHTML(formatAoiUsage(agent.aoiUsage), 'usage')}</div>
        <div class="row-progress">
          <div class="row-progress-fill" style="width: \${rowProgress}%"></div>
        </div>
      \`;
      
      allRowsEl.appendChild(row);
    });
    
    // Mark as ready
    document.getElementById('card-root').setAttribute('data-ready', 'true');
  </script>
</body>
</html>`;

  // Inject data
  const dataJson = JSON.stringify(payload);
  return html.replace('__CARD_DATA__', dataJson);
}

/**
 * Generate background template image using OpenAI DALL-E
 * This creates a template background without stats that the card content sits above
 */
async function generateBackgroundTemplate(): Promise<string | null> {
  try {
    const { OPENAI_API_KEY } = await import('../hardcoded-config.js');
    const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
    
    if (!apiKey) {
      console.log('[bg] OpenAI API key not set, using gradient background');
      return null;
    }
    
    const openai = new OpenAI({ apiKey });
    
    const prompt = `Create a premium, high-contrast, futuristic dashboard background for a business analytics card.

Visual direction:
- cinematic dark navy base (#081327 to #111c35), not flat
- layered depth with soft glass panels, subtle light rays, and controlled neon accents
- accent colors: cyan/teal (#22d3ee, #14b8a6) and violet (#8b5cf6)
- abstract data-tech motif: fine grid traces, geometric lines, and atmospheric particles
- polished enterprise quality (not cartoon, not noisy)

Hard constraints:
- NO text, NO numbers, NO logos, NO UI widgets
- keep central and lower-mid regions clean for overlaying metrics
- avoid heavy bloom over important content zones
- portrait composition suitable for 1290x2796 output`;

    console.log('[bg] Generating background template with OpenAI...');
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: "1024x1792", // DALL-E 3 max size, we'll scale it
      quality: "standard",
      n: 1,
    });
    
    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      console.log('[bg] No image URL returned from OpenAI');
      return null;
    }
    
    // Download and save the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Save to temp directory
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const bgPath = path.join(tempDir, `activity-card-bg-${Date.now()}.png`);
    fs.writeFileSync(bgPath, buffer);
    
    console.log('[bg] Background template generated:', bgPath);
    return bgPath;
  } catch (error: any) {
    console.error('[bg] Failed to generate background template:', error.message);
    return null;
  }
}

/**
 * Render card to PNG using Playwright - Maximum quality
 */
async function renderCardToPNG(payload: ActivityCardPayload, outputPath: string, backgroundImagePath?: string | null): Promise<void> {
  let browser: any = null;
  
  try {
    const { chromium } = await import('playwright');
    console.log('[render] Launching browser...');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1290, height: 2796 },
      deviceScaleFactor: 3 // Maximum crispness
    });
    
    // Always use the specified template background image
    // Try multiple possible paths
    const possiblePaths = [
      path.join(process.cwd(), '..', 'temp', 'activity-card-bg-template.png'), // From server/scripts -> ../temp
      path.join(process.cwd(), 'temp', 'activity-card-bg-template.png'), // From server -> temp
      backgroundImagePath // Use provided path if exists
    ].filter(Boolean) as string[];
    
    let bgImagePath: string | null = null;
    
    // Check each possible path
    for (const testPath of possiblePaths) {
      if (testPath && fs.existsSync(testPath)) {
        bgImagePath = testPath;
        console.log('✅ Using template background image:', bgImagePath);
        break;
      }
    }
    
    // If not found, try to generate or use fallback
    if (!bgImagePath) {
      console.log('⚠️ Template background not found at any expected location, checking cache or generating new...');
      const cachedBgPath = path.join(process.cwd(), 'temp', 'activity-card-bg-template.png');
      if (fs.existsSync(cachedBgPath)) {
        console.log('📦 Using cached background template');
        bgImagePath = cachedBgPath;
      } else {
        bgImagePath = await generateBackgroundTemplate();
      }
    }
    
    let html = generateHTML(payload);
    
    // Replace background image URL in HTML if we have one
    if (bgImagePath && fs.existsSync(bgImagePath)) {
      // Convert to data URL for embedding
      const bgBuffer = fs.readFileSync(bgImagePath);
      const bgBase64 = bgBuffer.toString('base64');
      const bgDataUrl = `data:image/png;base64,${bgBase64}`;
      html = html.replace(/__BACKGROUND_IMAGE_URL__/g, bgDataUrl);
      // Increase background visibility by 15%: reduce overlay opacities
      // Gradient overlay: keep at 0 (hidden) when background image is present
      html = html.replace(/__GRADIENT_OPACITY__/g, '0.24');
      html = html.replace(/__GLOW_OPACITY__/g, '0.3');
      console.log('✅ Background image embedded with balanced overlay for readability');
    } else {
      // Remove background image, use gradient only
      html = html.replace(/background-image: url\('__BACKGROUND_IMAGE_URL__'\);/g, '');
      html = html.replace(/url\('__BACKGROUND_IMAGE_URL__'/g, 'transparent');
      // Show full gradient when no background image
      html = html.replace(/__GRADIENT_OPACITY__/g, '0.95');
      // Show glow overlay when no background image
      html = html.replace(/__GLOW_OPACITY__/g, '0.9');
      console.log('⚠️ No background image, using gradient fallback');
    }
    
    console.log('[render] Loading HTML template...');
    await page.setContent(html, { waitUntil: 'networkidle' });
    
    // Wait for fonts and DOM ready
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(resolve);
        } else {
          setTimeout(resolve, 1500);
        }
      });
    });
    
    console.log('[render] Waiting for card to render...');
    await page.waitForSelector('#card-root[data-ready="true"]', { timeout: 8000 });
    
    
    console.log('[render] Taking screenshot...');
    const cardElement = page.locator('#card-root');
    await cardElement.screenshot({ 
      path: outputPath,
      type: 'png'
    });
    
    console.log(`[render] Card rendered to: ${outputPath}`);
  } catch (error) {
    console.error('[render] Failed to render card:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate activity card payload from real data (with demo data for testing)
 */
async function generatePayloadFromData(): Promise<ActivityCardPayload> {
  console.log('[card] Generating activity card from live data...');
  const payload = await buildActivityCardPayload();
  return payload as ActivityCardPayload;
}

/**
 * Main export: Render activity card and return file path
 */
export async function renderActivityCard(outputDir?: string, precomputedPayload?: ActivityCardPayload): Promise<string> {
  const outputPath = outputDir 
    ? path.join(outputDir, `activity-card-${Date.now()}.png`)
    : path.join(process.cwd(), 'temp', `activity-card-${Date.now()}.png`);
  
  // Ensure temp directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const payload = precomputedPayload || await generatePayloadFromData();
  
  // Use the specified template background image
  // Path is relative to server directory: ../temp/activity-card-bg-template.png
  // Or absolute from workspace: AOIrail/temp/activity-card-bg-template.png
  const templateBgPath = path.join(process.cwd(), '..', 'temp', 'activity-card-bg-template.png');
  const altTemplatePath = path.join(process.cwd(), 'temp', 'activity-card-bg-template.png');
  
  let bgImagePath: string | null = null;
  if (fs.existsSync(templateBgPath)) {
    bgImagePath = templateBgPath;
    console.log('✅ Using template background from:', templateBgPath);
  } else if (fs.existsSync(altTemplatePath)) {
    bgImagePath = altTemplatePath;
    console.log('✅ Using template background from:', altTemplatePath);
  } else {
    console.log('⚠️ Template background not found, generating new one...');
    bgImagePath = await generateBackgroundTemplate();
  }
  
  await renderCardToPNG(payload, outputPath, bgImagePath);
  
  // Upload to Supabase hourly-reports bucket
  try {
    console.log('[upload] Uploading to Supabase hourly-reports bucket...');
    const fileName = `activity-card-${Date.now()}.png`;
    const fileBuffer = fs.readFileSync(outputPath);
    
    // Upload to hourly-reports bucket
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('hourly-reports')
      .upload(fileName, fileBuffer, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (uploadError) {
      console.error('[upload] Failed to upload to Supabase:', uploadError);
      // Try installers bucket as fallback
      console.log('[upload] Trying installers bucket as fallback...');
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin.storage
        .from('installers')
        .upload(`hourly-reports/${fileName}`, fileBuffer, {
          contentType: 'image/png',
          upsert: true
        });
      
      if (fallbackError) {
        console.error('[upload] Failed to upload to fallback bucket:', fallbackError);
      } else {
        console.log('[upload] Uploaded to installers bucket fallback');
      }
    } else {
      console.log('[upload] Uploaded to Supabase hourly-reports bucket:', fileName);
      
      // Get public URL
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('hourly-reports')
        .getPublicUrl(fileName);
      
      if (publicUrlData?.publicUrl) {
        console.log('[upload] Public URL:', publicUrlData.publicUrl);
      }
    }
  } catch (error: any) {
    console.error('[upload] Error uploading to Supabase:', error.message);
    // Don't fail the whole operation if upload fails
  }
  
  return outputPath;
}
