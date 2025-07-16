<script setup lang="ts">
import KlineChart from './components/KlineChart.vue';
</script>

<template>
  <div class="app">
    <KlineChart symbol="ETH-USDT" interval="1m" />
  </div>
</template>

<style scoped>
.app {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
}
</style>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

#app {
  width: 100%;
  height: 100%;
}
</style>