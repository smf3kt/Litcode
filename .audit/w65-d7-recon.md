# wave D step 7 recon — the analytics transports (the deferred decision)

## surface
      27 services/analytics/config.ts
     307 services/analytics/datadog.ts
     451 services/analytics/firstPartyEventLogger.ts
     820 services/analytics/firstPartyEventLoggingExporter.ts
    1155 services/analytics/growthbook.ts
     173 services/analytics/index.ts
     948 services/analytics/metadata.ts
     114 services/analytics/sink.ts
      25 services/analytics/sinkKillswitch.ts
    4020 total

## who attaches the sink
./interactiveHelpers.tsx:27:  initializeGrowthBook,
./interactiveHelpers.tsx:208:    void initializeGrowthBook()
./interactiveHelpers.tsx:322:    // initializeGrowthBook promise fired earlier). Also warms the
./main.tsx:47:  initializeGrowthBook,
./cli/print.ts:327:import { initializeGrowthBook } from '../services/analytics/growthbook.js'
./cli/print.ts:523:  void initializeGrowthBook()
./utils/gracefulShutdown.ts:32:import { shutdownDatadog } from '../services/analytics/datadog.js'
./utils/gracefulShutdown.ts:33:import { shutdown1PEventLogging } from '../services/analytics/firstPartyEventLogger.js'
./utils/gracefulShutdown.ts:506:      Promise.all([shutdown1PEventLogging(), shutdownDatadog()]),
./entrypoints/init.ts:42:// initialize1PEventLogging is dynamically imported to defer OpenTelemetry sdk-logs/resources
./entrypoints/init.ts:88:      fp.initialize1PEventLogging()
./entrypoints/init.ts:93:        void fp.reinitialize1PEventLoggingIfConfigChanged()

## importers of the analytics package
     232

## transports (the network half)
services/analytics/firstPartyEventLoggingExporter.ts:129:      (process.env.ANTHROPIC_BASE_URL === 'https://api-staging.anthropic.com'
services/analytics/firstPartyEventLoggingExporter.ts:130:        ? 'https://api-staging.anthropic.com'
services/analytics/firstPartyEventLoggingExporter.ts:131:        : 'https://api.anthropic.com')
services/analytics/growthbook.ts:505:        ? process.env.CLAUDE_CODE_GB_BASE_URL || 'https://api.anthropic.com/'
services/analytics/growthbook.ts:506:        : 'https://api.anthropic.com/'
services/analytics/datadog.ts:13:  'https://http-intake.logs.us5.datadoghq.com/api/v2/logs'
