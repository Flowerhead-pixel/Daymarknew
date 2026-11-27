import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.daymark.goals',
  appName: 'Daymark',
  webDir: 'dist',
  backgroundColor: '#FAFAF7',
  android: {
    // The app talks to nothing on the internet; everything is local.
    allowMixedContent: false,
  },
}

export default config
