import { CpuInfo, cpus } from "os";
import { createClient } from "redis";
import { config } from "dotenv";
config();

const client = createClient({ url: process.env.REDIS_URL });
client.on("error", (error) => {
  console.error(error);
});
const key = "cpu_usage";
const setCpuUsage = async (cpusUsage: number[]) => {
  const payload = {
    cpusUsage,
    timestamp: Date.now(),
  };
  await client.set(key, JSON.stringify(payload));
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
    oldCpus = newCpus;
  }, interval);
}

const main = async () => {
  await client.connect();
  monitorCpuUsage();
};

main();
