import type { DataProvider, Bar } from '@luxalgo/vela';
import axios from 'axios';

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'crypto' | 'futures' | 'forex' | 'commodity';
  exchange?: string;
}

// 1. DHAN PROVIDER (NSE Stocks & Indices)
export class DhanProvider implements DataProvider {
  private apiToken: string;
  private clientId: string;

  constructor(clientId: string, apiToken: string) {
    this.clientId = clientId;
    this.apiToken = apiToken;
  }

  // Tells Vela's Symbol Search modal about available Dhan symbols
  async search(query: string): Promise<SymbolSearchResult[]> {
    const list: SymbolSearchResult[] = [
      { symbol: '13', name: 'NIFTY 50', type: 'stock', exchange: 'NSE' },
      { symbol: '25', name: 'BANKNIFTY', type: 'stock', exchange: 'NSE' },
      { symbol: '1333', name: 'RELIANCE', type: 'stock', exchange: 'NSE' },
      { symbol: '11536', name: 'TCS', type: 'stock', exchange: 'NSE' },
      { symbol: '1594', name: 'INFY', type: 'stock', exchange: 'NSE' },
    ];
    return list.filter(s => s.name.toLowerCase().includes(query.toLowerCase()) || s.symbol.includes(query));
  }

  async getHistory(params: { symbol: string; timeframe: string; from: number; to: number }): Promise<Bar[]> {
    try {
      const isIndex = params.symbol === '13' || params.symbol === '25';
      const exchangeSegment = isIndex ? 'INDEX_NSE' : 'NSE_EQ';

      const response = await axios.post(
        'https://api.dhan.co/v2/charts/historical',
        {
          securityId: params.symbol,
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

// 2. YAHOO FINANCE PROVIDER (NSE, Global Indices, Commodities, Forex)
export class YahooFinanceProvider implements DataProvider {
  private catalog: SymbolSearchResult[] = [
    // Stocks & Indices
    { symbol: '^NSEI', name: 'NIFTY 50 Index', type: 'stock', exchange: 'NSE' },
    { symbol: '^BSESN', name: 'SENSEX Index', type: 'stock', exchange: 'BSE' },
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'stock', exchange: 'NSE' },
    { symbol: 'TCS.NS', name: 'Tata Consultancy Services', type: 'stock', exchange: 'NSE' },
    { symbol: 'INFY.NS', name: 'Infosys', type: 'stock', exchange: 'NSE' },
    { symbol: '^GSPC', name: 'S&P 500 Index', type: 'stock', exchange: 'US' },
    { symbol: '^IXIC', name: 'NASDAQ Composite', type: 'stock', exchange: 'US' },
    
    // Commodities & Futures
    { symbol: 'GC=F', name: 'Gold Futures', type: 'commodity', exchange: 'COMEX' },
    { symbol: 'SI=F', name: 'Silver Futures', type: 'commodity', exchange: 'COMEX' },
    { symbol: 'CL=F', name: 'Crude Oil Futures', type: 'commodity', exchange: 'NYMEX' },

    // Forex
    { symbol: 'USDINR=X', name: 'USD/INR', type: 'forex', exchange: 'FX' },
    { symbol: 'EURUSD=X', name: 'EUR/USD', type: 'forex', exchange: 'FX' },
  ];

  async search(query: string): Promise<SymbolSearchResult[]> {
    if (!query) return this.catalog;
    const q = query.toLowerCase();
    return this.catalog.filter(item => 
      item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
    );
  }

  async getHistory(params: { symbol: string; timeframe: string; from: number; to: number }): Promise<Bar[]> {
    try {
      const rawUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${params.symbol}?period1=${params.from}&period2=${params.to}&interval=1d`;
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

// 3. ALPHA VANTAGE PROVIDER
export class AlphaVantageProvider implements DataProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string): Promise<SymbolSearchResult[]> {
    const list: SymbolSearchResult[] = [
      { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ' },
      { symbol: 'MSFT', name: 'Microsoft Corp.', type: 'stock', exchange: 'NASDAQ' },
      { symbol: 'IBM', name: 'IBM Corp.', type: 'stock', exchange: 'NYSE' },
    ];
    return list.filter(s => s.symbol.toLowerCase().includes(query.toLowerCase()));
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
