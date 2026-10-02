import type { DataProvider, Bar } from '@luxalgo/vela';
import axios from 'axios';

// 1. DHAN PROVIDER (NSE Stocks & Derivatives)
export class DhanProvider implements DataProvider {
  private apiToken: string;
  private clientId: string;

  constructor(clientId: string, apiToken: string) {
    this.clientId = clientId;
    this.apiToken = apiToken;
  }

  async getHistory(params: { symbol: string; timeframe: string; from: number; to: number }): Promise<Bar[]> {
    try {
      // Dhan Historical Candles Endpoint
      const response = await axios.post(
        'https://api.dhan.co/v2/charts/historical',
        {
          securityId: params.symbol, // e.g., Dhan Security ID (13 for Nifty 50, etc.)
          exchangeSegment: 'NSE_EQ',
          instrumentType: 'EQUITY',
          expiryCode: 0,
          fromDate: new Date(params.from * 1000).toISOString().split('T')[0],
          toDate: new Date(params.to * 1000).toISOString().split('T')[0],
        },
        {
          headers: {
            'access-token': this.apiToken,
            'client-id': this.clientId,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data;
      if (!data || !data.start_time) return [];

      // Transform Dhan response array into Vela Bar structure
      return data.start_time.map((time: number, index: number) => ({
        time: time,
        open: data.open[index],
        high: data.high[index],
        low: data.low[index],
        close: data.close[index],
        volume: data.volume[index],
      }));
    } catch (err) {
      console.error('Dhan API Error:', err);
      return [];
    }
  }
}

// 2. YAHOO FINANCE PROVIDER (Global Indices, NSE via .NS tickers, Commodities)
export class YahooFinanceProvider implements DataProvider {
  async getHistory(params: { symbol: string; timeframe: string; from: number; to: number }): Promise<Bar[]> {
    try {
      // Free public chart endpoint
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${params.symbol}?period1=${params.from}&period2=${params.to}&interval=1d`;
      const response = await axios.get(url);
      const result = response.data.chart.result[0];
      
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];

      return timestamps.map((time: number, idx: number) => ({
        time: time,
        open: quotes.open[idx],
        high: quotes.high[idx],
        low: quotes.low[idx],
        close: quotes.close[idx],
        volume: quotes.volume[idx] || 0,
      }));
    } catch (err) {
      console.error('Yahoo Finance API Error:', err);
      return [];
    }
  }
}

// 3. ALPHA VANTAGE PROVIDER (US Stocks, Forex, Global Commodities)
export class AlphaVantageProvider implements DataProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getHistory(params: { symbol: string; timeframe: string; from: number; to: number }): Promise<Bar[]> {
    try {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${params.symbol}&apikey=${this.apiKey}`;
      const response = await axios.get(url);
      const timeSeries = response.data['Time Series (Daily)'];
      
      if (!timeSeries) return [];

      const bars: Bar[] = [];
      for (const dateStr in timeSeries) {
        const item = timeSeries[dateStr];
        bars.push({
          time: Math.floor(new Date(dateStr).getTime() / 1000),
          open: parseFloat(item['1. open']),
          high: parseFloat(item['2. high']),
          low: parseFloat(item['3. low']),
          close: parseFloat(item['4. close']),
          volume: parseFloat(item['5. volume']),
        });
      }

      // Sort chronological
      return bars.sort((a, b) => a.time - b.time);
    } catch (err) {
      console.error('Alpha Vantage API Error:', err);
      return [];
    }
  }
}
