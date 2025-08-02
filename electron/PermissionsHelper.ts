import { systemPreferences, shell } from 'electron'

export class PermissionsHelper {
  
  public static async checkScreenCapturePermission(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return true // Only needed on macOS
    }

    try {
      // Check if we have screen capture permission
      const hasPermission = systemPreferences.getMediaAccessStatus('screen') === 'granted'
      console.log('[PermissionsHelper] Screen capture permission status:', hasPermission)
      return hasPermission
    } catch (error) {
      console.error('[PermissionsHelper] Error checking screen permission:', error)
      // If we can't check, assume we don't have permission
      return false
    }
  }

  public static async openScreenRecordingSettings(): Promise<void> {
    try {
      console.log('[PermissionsHelper] Opening screen recording settings...')
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
    } catch (error) {
      console.error('[PermissionsHelper] Error opening settings:', error)
      // Fallback to general security settings
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security')
    }
  }

  public static async handlePermissionForContextCapture(): Promise<boolean> {
    const hasPermission = await this.checkScreenCapturePermission()
    
    if (!hasPermission && process.platform === 'darwin') {
      console.log('[PermissionsHelper] Screen recording permission needed for context detection')
      console.log('[PermissionsHelper] To enable: System Preferences → Privacy & Security → Screen Recording → Enable CreativEase')
    }
    
    return hasPermission
  }

  public static getPermissionInstructions(): string {
    if (process.platform === 'darwin') {
      return 'To enable context detection:\n1. Open System Preferences\n2. Go to Privacy & Security → Screen Recording\n3. Enable CreativEase Coach\n4. Restart the app'
    }
    return 'Screen recording permissions are only required on macOS'
  }
} 