<template>
  <div class="kline-container">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="symbol-info">
          <h1 class="symbol-title">{{ currentSymbolInfo?.name || selectedSymbol }}</h1>
          <span class="symbol-subtitle">{{ currentSymbolInfo?.label || selectedSymbol }} 实时K线图</span>
        </div>
        <div class="price-display">
          <div class="current-price" :class="priceChangeClass">
            ${{ currentPrice.toFixed(2) }}
          </div>
          <div class="price-change" :class="priceChangeClass">
            <span class="change-value">
              {{ priceChange > 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}
            </span>
            <span class="change-percent">
              ({{ priceChangePercent.toFixed(2) }}%)
            </span>
          </div>
        </div>
      </div>
      
      <div class="toolbar-right">
        <!-- 时间周期选择器 -->
        <div class="period-selector">
          <button 
            v-for="period in timePeriods" 
            :key="period.value"
            @click="changePeriod(period.value)"
            :class="{ active: selectedInterval === period.value }"
            class="period-chip"
          >
            {{ period.label }}
          </button>
        </div>
        
        <!-- 控制按钮组 -->
        <div class="control-group">
          <!-- 币种选择器 -->
          <div class="select-wrapper">
            <select v-model="selectedSymbol" @change="changeSymbol" class="modern-select symbol-select">
              <option 
                v-for="symbol in supportedSymbols" 
                :key="symbol.value" 
                :value="symbol.value"
              >
                {{ symbol.label }}
              </option>
            </select>
          </div>
          
          <!-- 时间间隔选择器 -->
          <div class="select-wrapper">
            <select v-model="selectedInterval" @change="changeInterval" class="modern-select">
              <option value="1m">1分钟</option>
              <option value="5m">5分钟</option>
              <option value="15m">15分钟</option>
              <option value="30m">30分钟</option>
              <option value="1H">1小时</option>
              <option value="4H">4小时</option>
              <option value="1D">1天</option>
              <option value="1W">1周</option>
              <option value="1M">1月</option>
              <option value="1Y">1年</option>
            </select>
          </div>
          
          <button 
            @click="toggleAutoRefresh" 
            :class="{ active: autoRefresh }" 
            class="refresh-toggle"
          >
            <span class="refresh-text">{{ autoRefresh ? '自动刷新' : '手动刷新' }}</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 图表区域 -->
    <div class="chart-container">
      <div class="chart-card">
        <v-chart 
          ref="chartRef"
          class="chart" 
          :option="chartOption" 
          :loading="loading"
          autoresize
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { CandlestickChart, LineChart, BarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent
} from 'echarts/components';
import VChart from 'vue-echarts';
import { okxApi, type KlineData } from '../services/okxApi';

// 注册 ECharts 组件
use([
  CanvasRenderer,
  CandlestickChart,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent
]);

// Props
interface Props {
  symbol?: string;
  interval?: string;
}

const props = withDefaults(defineProps<Props>(), {
  symbol: 'ETH-USDT',
  interval: '1D'
});

// 响应式数据
const loading = ref(true);
const klineData = ref<KlineData[]>([]);
const currentPrice = ref(0);
const previousPrice = ref(0);
const selectedInterval = ref(props.interval);
const autoRefresh = ref(true);
const chartRef = ref();

// 定时器
let refreshTimer: number | null = null;

// 缩放状态保存
const zoomState = ref({
  start: 80,
  end: 100
});

// 时间周期配置
const timePeriods = ref([
  { label: '日线', value: '1D' },
  { label: '周线', value: '1W' },
  { label: '月线', value: '1M' },
  { label: '年线', value: '1Y' }
]);

// 支持的交易对配置
const supportedSymbols = ref([
  { label: 'ETH/USDT', value: 'ETH-USDT', name: 'Ethereum' },
  { label: 'BTC/USDT', value: 'BTC-USDT', name: 'Bitcoin' },
  { label: 'BNB/USDT', value: 'BNB-USDT', name: 'BNB' },
  { label: 'ADA/USDT', value: 'ADA-USDT', name: 'Cardano' },
  { label: 'SOL/USDT', value: 'SOL-USDT', name: 'Solana' },
  { label: 'XRP/USDT', value: 'XRP-USDT', name: 'Ripple' },
  { label: 'DOT/USDT', value: 'DOT-USDT', name: 'Polkadot' },
  { label: 'DOGE/USDT', value: 'DOGE-USDT', name: 'Dogecoin' },
  { label: 'AVAX/USDT', value: 'AVAX-USDT', name: 'Avalanche' },
  { label: 'MATIC/USDT', value: 'MATIC-USDT', name: 'Polygon' },
  { label: 'LINK/USDT', value: 'LINK-USDT', name: 'Chainlink' },
  { label: 'UNI/USDT', value: 'UNI-USDT', name: 'Uniswap' }
]);

const selectedSymbol = ref(props.symbol);

// 计算属性
const currentSymbolInfo = computed(() => 
  supportedSymbols.value.find(symbol => symbol.value === selectedSymbol.value)
);

const priceChange = computed(() => currentPrice.value - previousPrice.value);
const priceChangePercent = computed(() => 
  previousPrice.value ? (priceChange.value / previousPrice.value) * 100 : 0
);
const priceChangeClass = computed(() => ({
  'price-up': priceChange.value > 0,
  'price-down': priceChange.value < 0,
  'price-neutral': priceChange.value === 0
}));

// 格式化时间显示
const formatDateTime = (timestamp: number) => {
  const date = new Date(timestamp);
  
  switch (selectedInterval.value) {
    case '1Y':
      return date.getFullYear().toString();
    case '1M':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    case '1W':
    case '1D':
      return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    case '4H':
    case '1H':
      return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
    default:
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
};

// 图表配置
const chartOption = computed(() => {
  const dates = klineData.value.map(item => formatDateTime(item.timestamp));
  const candlestickData = klineData.value.map(item => [item.open, item.close, item.low, item.high]);
  const volumeData = klineData.value.map(item => item.volume);

  return {
    animation: false,
    color: ['#c23531', '#2f4554', '#61a0a8', '#d48265'],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.3)',
          width: 1,
          type: 'dashed'
        }
      },
      backgroundColor: 'rgba(20, 20, 30, 0.95)',
      borderColor: 'rgba(64, 224, 208, 0.5)',
      borderWidth: 1,
      textStyle: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 500
      },
      padding: [12, 16],
      formatter: function (params: any) {
        if (!params || params.length === 0) return '';
        
        const klineParam = params.find((p: any) => p.seriesName === 'K线');
        const volumeParam = params.find((p: any) => p.seriesName === '成交量');
        
        if (!klineParam) return '';
        
        const data = klineParam.data;
        const [open, close, low, high] = data;
        const volume = volumeParam ? volumeParam.data : 0;
        
        // 计算涨跌额和涨跌幅
        const change = close - open;
        const changePercent = open !== 0 ? (change / open) * 100 : 0;
        
        // 计算振幅
        const amplitude = open !== 0 ? ((high - low) / open) * 100 : 0;
        
        // 计算成交额 (价格 * 成交量)
        const turnover = (high + low + open + close) / 4 * volume;
        
        // 格式化数字
        const formatNumber = (num: number, decimals = 2) => {
          if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
          if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
          if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
          return num.toFixed(decimals);
        };
        
        const formatPrice = (price: number) => price.toFixed(4);
        
        // 颜色样式
        const changeColor = change >= 0 ? '#4CAF50' : '#F44336';
        const changeSymbol = change >= 0 ? '+' : '';
        
        return `
          <div style="font-family: 'Inter', sans-serif; line-height: 1.6;">
            <div style="color: #40E0D0; font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid rgba(64, 224, 208, 0.3); padding-bottom: 4px;">
              ${klineParam.name}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 12px;">
              <div><span style="color: #999;">开盘:</span> <span style="color: #fff; font-weight: 600;">${formatPrice(open)}</span></div>
              <div><span style="color: #999;">最高:</span> <span style="color: #4CAF50; font-weight: 600;">${formatPrice(high)}</span></div>
              <div><span style="color: #999;">最低:</span> <span style="color: #F44336; font-weight: 600;">${formatPrice(low)}</span></div>
              <div><span style="color: #999;">收盘:</span> <span style="color: #fff; font-weight: 600;">${formatPrice(close)}</span></div>
              <div><span style="color: #999;">涨跌额:</span> <span style="color: ${changeColor}; font-weight: 600;">${changeSymbol}${formatPrice(change)}</span></div>
              <div><span style="color: #999;">涨跌幅:</span> <span style="color: ${changeColor}; font-weight: 600;">${changeSymbol}${changePercent.toFixed(2)}%</span></div>
              <div><span style="color: #999;">振幅:</span> <span style="color: #FFB74D; font-weight: 600;">${amplitude.toFixed(2)}%</span></div>
              <div><span style="color: #999;">成交量:</span> <span style="color: #81C784; font-weight: 600;">${formatNumber(volume)}</span></div>
            </div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <span style="color: #999;">成交额:</span> <span style="color: #9C27B0; font-weight: 600;">$${formatNumber(turnover)}</span>
            </div>
          </div>
        `;
      }
    },
    grid: [
      {
        left: '10%',
        right: '8%',
        height: '60%'
      },
      {
        left: '10%',
        right: '8%',
        top: '75%',
        height: '15%'
      }
    ],
    xAxis: [
      {
        type: 'category',
        data: dates,
        scale: true,
        boundaryGap: false,
        axisLine: { onZero: false },
        splitLine: { show: false },
        min: 'dataMin',
        max: 'dataMax'
      },
      {
        type: 'category',
        gridIndex: 1,
        data: dates,
        scale: true,
        boundaryGap: false,
        axisLine: { onZero: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        min: 'dataMin',
        max: 'dataMax'
      }
    ],
    yAxis: [
      {
        scale: true,
        splitArea: {
          show: false
        },
        splitLine: {
          show: false
        },
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        }
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false }
      }
    ],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0, 1],
        start: zoomState.value.start,
        end: zoomState.value.end
      },
      {
        show: true,
        xAxisIndex: [0, 1],
        type: 'slider',
        top: '90%',
        start: zoomState.value.start,
        end: zoomState.value.end
      }
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: candlestickData,
        itemStyle: {
          color: 'rgba(76, 175, 80, 0.8)',
          color0: 'rgba(244, 67, 54, 0.8)',
          borderColor: 'rgba(76, 175, 80, 0.9)',
          borderColor0: 'rgba(244, 67, 54, 0.9)',
          shadowColor: 'rgba(76, 175, 80, 0.3)',
          shadowBlur: 3,
          shadowOffsetY: 1
        }
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumeData,
        itemStyle: {
          color: function (params: any) {
            const index = params.dataIndex;
            const current = klineData.value[index];
            return current.close >= current.open ? 'rgba(76, 175, 80, 0.6)' : 'rgba(244, 67, 54, 0.6)';
          },
          shadowColor: 'rgba(0, 0, 0, 0.2)',
          shadowBlur: 2,
          shadowOffsetY: 1
        }
      }
    ]
  };
});

// 方法
const fetchKlineData = async (isAutoRefresh = false) => {
  try {
    if (!isAutoRefresh) {
      loading.value = true;
    }
    
    const data = await okxApi.getKlineData(selectedSymbol.value, selectedInterval.value, 200);
    
    if (data.length > 0) {
      // 保存之前的价格用于计算涨跌
      if (klineData.value.length > 0) {
        previousPrice.value = klineData.value[klineData.value.length - 1].close;
      }
      
      // 如果是自动刷新，尝试增量更新
      if (isAutoRefresh && klineData.value.length > 0) {
        updateChartData(data);
      } else {
        klineData.value = data;
      }
      
      currentPrice.value = data[data.length - 1].close;
    }
  } catch (error) {
    console.error('获取K线数据失败:', error);
  } finally {
    if (!isAutoRefresh) {
      loading.value = false;
    }
  }
};

// 增量更新图表数据，保持缩放状态
const updateChartData = (newData: KlineData[]) => {
  if (!chartRef.value) {
    klineData.value = newData;
    return;
  }

  const chart = chartRef.value;
  
  // 保存当前缩放状态
  const currentOption = chart.getOption();
  let currentZoom = null;
  if (currentOption.dataZoom && currentOption.dataZoom[0]) {
    currentZoom = {
      start: currentOption.dataZoom[0].start,
      end: currentOption.dataZoom[0].end
    };
  }

  // 检查是否有新数据
  const lastOldTimestamp = klineData.value.length > 0 ? klineData.value[klineData.value.length - 1].timestamp : 0;
  const hasNewData = newData.some(item => item.timestamp > lastOldTimestamp);
  
  if (hasNewData || newData.length !== klineData.value.length) {
    // 更新数据
    klineData.value = newData;
    
    // 如果有保存的缩放状态，恢复它
    if (currentZoom) {
      zoomState.value = currentZoom;
      
      // 延迟恢复缩放状态，确保图表已更新
      setTimeout(() => {
        if (chartRef.value) {
          chartRef.value.dispatchAction({
            type: 'dataZoom',
            start: currentZoom.start,
            end: currentZoom.end
          });
        }
      }, 50);
    }
  }
};

const changeInterval = () => {
  fetchKlineData();
};

const changePeriod = (period: string) => {
  selectedInterval.value = period;
  fetchKlineData();
};

const changeSymbol = () => {
  // 重置价格历史，避免显示错误的涨跌幅
  previousPrice.value = 0;
  fetchKlineData();
};

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value;
  if (autoRefresh.value) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
};

const startAutoRefresh = () => {
  if (refreshTimer) clearInterval(refreshTimer);
  
  // 根据时间间隔设置刷新频率
  const refreshInterval = selectedInterval.value === '1m' ? 5000 : 
                         selectedInterval.value === '5m' ? 15000 : 30000;
  
  refreshTimer = setInterval(() => fetchKlineData(true), refreshInterval);
};

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

// 保存缩放状态
const saveZoomState = () => {
  if (chartRef.value) {
    const chart = chartRef.value;
    const option = chart.getOption();
    if (option.dataZoom && option.dataZoom[0]) {
      zoomState.value = {
        start: option.dataZoom[0].start || 80,
        end: option.dataZoom[0].end || 100
      };
    }
  }
};

// 生命周期
onMounted(async () => {
  await fetchKlineData();
  if (autoRefresh.value) {
    startAutoRefresh();
  }
  
  // 等待图表渲染完成后绑定事件
  setTimeout(() => {
    if (chartRef.value) {
      const chart = chartRef.value;
      chart.on('dataZoom', (params: any) => {
        if (params.batch && params.batch[0]) {
          zoomState.value = {
            start: params.batch[0].start,
            end: params.batch[0].end
          };
        } else if (params.start !== undefined && params.end !== undefined) {
          zoomState.value = {
            start: params.start,
            end: params.end
          };
        }
      });
    }
  }, 100);
});

onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<style scoped>
/* 主容器 - 现代化深色主题 */
.kline-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
  color: #ffffff;
  font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  overflow: hidden;
}

/* 顶部工具栏 - Material Design风格 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  position: relative;
  z-index: 10;
}

.toolbar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, rgba(64, 224, 208, 0.1) 0%, rgba(255, 20, 147, 0.1) 100%);
  opacity: 0.3;
  z-index: -1;
}

/* 左侧信息区域 */
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 32px;
}

.symbol-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.symbol-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, #40e0d0 0%, #ff1493 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.5px;
}

.symbol-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

/* 价格显示区域 */
.price-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
}

.current-price {
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.price-change {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.change-value {
  font-weight: 700;
}

.change-percent {
  opacity: 0.9;
}

/* 价格颜色状态 */
.price-up {
  color: rgba(76, 175, 80, 0.95);
  text-shadow: 0 0 15px rgba(76, 175, 80, 0.2);
}

.price-down {
  color: rgba(244, 67, 54, 0.95);
  text-shadow: 0 0 15px rgba(244, 67, 54, 0.2);
}

.price-neutral {
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
}

/* 右侧控制区域 */
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 24px;
}

/* 时间周期选择器 */
.period-selector {
  display: flex;
  gap: 4px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
}

.period-chip {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 14px;
  font-weight: 600;
  position: relative;
  overflow: hidden;
}

.period-chip::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #40e0d0, #ff1493);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.period-chip:hover {
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

.period-chip:hover::before {
  opacity: 0.1;
}

.period-chip.active {
  color: #ffffff;
  background: linear-gradient(135deg, #40e0d0, #ff1493);
  box-shadow: 0 8px 25px rgba(64, 224, 208, 0.3);
  transform: translateY(-2px);
}

/* 控制按钮组 */
.control-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* 现代化选择框 */
.select-wrapper {
  position: relative;
}

/* 币种选择器特殊样式 */
.symbol-select {
  min-width: 160px;
  background: linear-gradient(135deg, rgba(64, 224, 208, 0.1), rgba(255, 20, 147, 0.1));
  border: 1px solid rgba(64, 224, 208, 0.3);
  font-weight: 600;
}

.symbol-select:hover {
  border-color: rgba(64, 224, 208, 0.5);
  background: linear-gradient(135deg, rgba(64, 224, 208, 0.15), rgba(255, 20, 147, 0.15));
}

.symbol-select:focus {
  border-color: #40e0d0;
  box-shadow: 0 0 0 3px rgba(64, 224, 208, 0.3);
  background: linear-gradient(135deg, rgba(64, 224, 208, 0.2), rgba(255, 20, 147, 0.2));
}

.select-wrapper::after {
  content: '▼';
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.6);
  pointer-events: none;
  font-size: 12px;
  transition: all 0.3s ease;
}

.modern-select {
  padding: 12px 40px 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  appearance: none;
  min-width: 140px;
  position: relative;
}

.modern-select:focus {
  outline: none;
  border-color: #40e0d0;
  box-shadow: 0 0 0 3px rgba(64, 224, 208, 0.2);
  background: rgba(255, 255, 255, 0.12);
}

.modern-select:hover {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.12);
}

.modern-select:focus + .select-wrapper::after,
.modern-select:hover + .select-wrapper::after {
  color: #40e0d0;
}

/* 选择框选项样式 */
.modern-select option {
  background: #1a1a2e;
  color: #ffffff;
  padding: 12px 16px;
  border: none;
  font-size: 14px;
  font-weight: 500;
}

/* 刷新按钮 */
.refresh-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 14px;
  font-weight: 600;
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}

.refresh-toggle::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #00ff88, #40e0d0);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.refresh-toggle:hover {
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

.refresh-toggle:hover::before {
  opacity: 0.1;
}

.refresh-toggle.active {
  color: #ffffff;
  background: linear-gradient(135deg, #00ff88, #40e0d0);
  box-shadow: 0 8px 25px rgba(0, 255, 136, 0.3);
  transform: translateY(-2px);
}

/* 图表容器 */
.chart-container {
  flex: 1;
  padding: 24px 32px 32px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chart-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  overflow: hidden;
  position: relative;
}

.chart-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
}

.chart {
  width: 100%;
  height: 100%;
  border-radius: 20px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .toolbar {
    padding: 20px 24px;
  }
  
  .toolbar-left {
    gap: 24px;
  }
  
  .toolbar-right {
    gap: 16px;
  }
  
  .symbol-title {
    font-size: 24px;
  }
  
  .current-price {
    font-size: 28px;
  }
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    gap: 20px;
    padding: 16px 20px;
  }
  
  .toolbar-left {
    width: 100%;
    justify-content: space-between;
    gap: 16px;
  }
  
  .toolbar-right {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .period-selector {
    order: 1;
    width: 100%;
    justify-content: center;
  }
  
  .control-group {
    order: 2;
    gap: 12px;
  }
  
  .price-display {
    padding: 12px 16px;
  }
  
  .current-price {
    font-size: 24px;
  }
  
  .chart-container {
    padding: 16px 20px 20px;
  }
}

@media (max-width: 480px) {
  .symbol-title {
    font-size: 20px;
  }
  
  .current-price {
    font-size: 20px;
  }
  
  .period-chip {
    padding: 8px 12px;
    font-size: 12px;
  }
  
  .modern-select,
  .refresh-toggle {
    padding: 8px 12px;
    font-size: 12px;
  }
}

/* 加载状态动画 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.chart[loading] {
  animation: pulse 2s ease-in-out infinite;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>