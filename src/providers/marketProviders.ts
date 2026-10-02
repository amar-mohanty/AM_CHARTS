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
      // Determine exchange segment based on symbol format or default to NSE_EQ
      const isIndex = params.symbol.toLowerCase().includes('nifty') || params.symbol.toLowerCase().includes('sensex');
      const exchangeSegment = isIndex ? 'INDEX_NSE' : 'NSE_EQ';

      const response = await axios.post(
        'https://api.dhan.co/v2/charts/historical',
        {
          securityId: params.symbol, // Dhan Security ID
          exchangeSegment: exchangeSegment,
          instrumentType: isIndex ? 'INDEX' : 'EQUITY',
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

      return data.start_time.map((time: number, index: number) => ({
        time: time,
        open: data.open[index],
        high: data.high[index],
        low: data.low[index],
        close: data.close[index],
        volume: data.volume ? data.volume[index] : 0,
      }));
    } catch (err) {
      console.error('Dhan API Error:', err);
      return [];
    }
  }
}

// 2. YAHOO FINANCE PROVIDER (Global Indices, NSE .NS tickers, Commodities)
export class YahooFinanceProvider implements DataProvider {
  async getHistory(params: { symbol: string; timeframe: string; from: number; to: number }): Promise<Bar[]> {
    try {
      const rawUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${params.symbol}?period1=${params.from}&period2=${params.to}&interval=1d`;
      // Route through CORS proxy to prevent browser blocks
      const url = `https://corsproxy.io/?${encodeURIComponent(rawUrl)}`;
      
      const response = await axios.get(url);
      const result = response.data?.chart?.result?.[0];
      
      if (!result || !result.timestamp) return [];

      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];

      return timestamps.map((time: number, idx: number) => ({
        time: time,
        open: quotes.open[idx],
        high: quotes.high[idx],
        low: quotes.low[idx],
        close: quotes.close[idx],
        volume: quotes.volume ? quotes.volume[idx] : 0,
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

      return bars.sort((a, b) => a.time - b.time);
    } catch (err) {
      console.error('Alpha Vantage API Error:', err);
      return [];
    }
  }
}
