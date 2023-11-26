import { CpuInfo, cpus } from "os";
import { createClient } from "redis";
import { config } from "dotenv";
config();

const client = createClient({ url: process.env.REDIS_URL });
client.on("error", (error) => {
  console.error(error);
});
const HISTORICAL_CPU_USAGE = "historical_cpu_usage";
const CPU_USAGE = "cpu_usage";
const setCpuUsage = async (cpusUsage: number[]) => {
  const payload = {
    cpusUsage,
    timestamp: Date.now(),
  };
  await client.set(CPU_USAGE, JSON.stringify(payload));
};

const setHistoricalCpuUsage = async (cpusUsage: number[]) => {
  const historicalCpuUsage = await client.get(HISTORICAL_CPU_USAGE);
  const newCpuUsage = {
    cpusUsage,
    timestamp: Date.now(),
  };
  if (!historicalCpuUsage) {
    await client.set(HISTORICAL_CPU_USAGE, JSON.stringify([newCpuUsage]));
    return;
  }
  const parsedHistoricalCpuUsage = JSON.parse(historicalCpuUsage) as {
    cpusUsage: number[];
    timestamp: number;
  }[];
  // parsedHistoricalCpuUsage contains the last 60 seconds of cpu usage
  // we need to remove the first element and add the new one
  if (parsedHistoricalCpuUsage.length >= 60) {
    parsedHistoricalCpuUsage.shift();
  }
  parsedHistoricalCpuUsage.push(newCpuUsage);
  await client.set(HISTORICAL_CPU_USAGE, JSON.stringify(parsedHistoricalCpuUsage));
};

function calculateCpuUsage(oldCpus: CpuInfo[], newCpus: CpuInfo[]) {
  const cpusUsage: number[] = [];
  for (let i = 0; i < newCpus.length; i++) {
    const oldCpu = oldCpus[i];
    const newCpu = newCpus[i];
    const totalDiff = Object.keys(newCpu.times).reduce((total, key) => {
      return total + (newCpu.times[key] - oldCpu.times[key]);
    }, 0);

    const idleDiff = newCpu.times.idle - oldCpu.times.idle;
    cpusUsage.push((totalDiff - idleDiff) / totalDiff);
  }
  return cpusUsage;
}

function monitorCpuUsage(interval = 1000) {
  let oldCpus = cpus();
  setInterval(() => {
    const newCpus = cpus();
    const cpusUsage = calculateCpuUsage(oldCpus, newCpus);
    setCpuUsage(cpusUsage);
    setHistoricalCpuUsage(cpusUsage);
    oldCpus = newCpus;
  }, interval);
}

const main = async () => {
  await client.connect();
  monitorCpuUsage();
};

main();
