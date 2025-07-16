import axios from 'axios';

// OKX API 基础配置
const OKX_BASE_URL = 'https://www.okx.com';

// K线数据接口
export interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// OKX API 返回的原始数据格式
type OKXKlineResponse = string[][];

export class OKXApi {
  private baseURL: string;

  constructor() {
    this.baseURL = OKX_BASE_URL;
  }

  /**
   * 获取K线数据
   * @param instId 交易对，如 'ETH-USDT'
   * @param bar K线周期，如 '1m', '5m', '15m', '1H', '1D'
   * @param limit 数据条数，默认100
   */
  async getKlineData(
    instId: string = 'ETH-USDT',
    bar: string = '1m',
    limit: number = 100
  ): Promise<KlineData[]> {
    try {
      const response = await axios.get(`${this.baseURL}/api/v5/market/candles`, {
        params: {
          instId,
          bar,
          limit: limit.toString()
        }
      });

      if (response.data.code !== '0') {
        throw new Error(`OKX API Error: ${response.data.msg}`);
      }

      const rawData: OKXKlineResponse = response.data.data;
      console.log(rawData);
      
      // 转换数据格式并按时间排序（OKX返回的数据是倒序的）
      return rawData
        .map(item => ({
          timestamp: parseInt(item[0]),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5])
        }))
        .reverse(); // 转为正序（时间从早到晚）
    } catch (error) {
      console.error('获取K线数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取实时价格
   */
  async getCurrentPrice(instId: string = 'ETH-USDT'): Promise<number> {
    try {
      const response = await axios.get(`${this.baseURL}/api/v5/market/ticker`, {
        params: { instId }
      });

      if (response.data.code !== '0') {
        throw new Error(`OKX API Error: ${response.data.msg}`);
      }

      return parseFloat(response.data.data[0].last);
    } catch (error) {
      console.error('获取实时价格失败:', error);
      throw error;
    }
  }
}

export const okxApi = new OKXApi();