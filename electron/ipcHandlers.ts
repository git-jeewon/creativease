// ipcHandlers.ts

import { ipcMain, app } from "electron"
import { AppState } from "./main"

export function initializeIpcHandlers(appState: AppState): void {
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        appState.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return appState.deleteScreenshot(path)
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await appState.takeScreenshot()
      const preview = await appState.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      throw error
    }
  })

  ipcMain.handle("get-screenshots", async () => {
    console.log({ view: appState.getView() })
    try {
      let previews = []
      if (appState.getView() === "queue") {
        previews = await Promise.all(
          appState.getScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      } else {
        previews = await Promise.all(
          appState.getExtraScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      }
      previews.forEach((preview: any) => console.log(preview.path))
      return previews
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  ipcMain.handle("toggle-window", async () => {
    appState.toggleMainWindow()
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      appState.clearQueues()
      console.log("Screenshot queues have been cleared.")
      return { success: true }
    } catch (error: any) {
      console.error("Error resetting queues:", error)
      return { success: false, error: error.message }
    }
  })

  // IPC handler for analyzing audio from base64 data
  ipcMain.handle("analyze-audio-base64", async (event, data: string, mimeType: string) => {
    try {
      const result = await appState.processingHelper.processAudioBase64(data, mimeType)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-base64 handler:", error)
      throw error
    }
  })

  // IPC handler for CreativEase Coach guidance
  ipcMain.handle("get-creative-guidance", async (event, data: string, mimeType: string) => {
    try {
      const result = await appState.processingHelper.getCreativeCoachGuidance(data, mimeType)
      return result
    } catch (error: any) {
      console.error("Error in get-creative-guidance handler:", error)
      throw error
    }
  })

  // IPC handler for CreativEase Coach guidance from text
  ipcMain.handle("get-creative-guidance-from-text", async (event, userQuestion: string, captureContext: boolean = true) => {
    try {
      const result = await appState.processingHelper.getCreativeCoachGuidanceFromText(userQuestion, captureContext)
      return result
    } catch (error: any) {
      console.error("Error in get-creative-guidance-from-text handler:", error)
      throw error
    }
  })

  // IPC handler for capturing context only
  ipcMain.handle("capture-context", async (event) => {
    try {
      const context = await appState.contextHelper.captureAndAnalyzeContext()
      return context
    } catch (error: any) {
      console.error("Error in capture-context handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing audio from file path
  ipcMain.handle("analyze-audio-file", async (event, path: string) => {
    try {
      const result = await appState.processingHelper.processAudioFile(path)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-file handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing image from file path
  ipcMain.handle("analyze-image-file", async (event, path: string) => {
    try {
      const result = await appState.processingHelper.getLLMHelper().analyzeImageFile(path)
      return result
    } catch (error: any) {
      console.error("Error in analyze-image-file handler:", error)
      throw error
    }
  })

  // Permission management handlers
  ipcMain.handle("open-screen-recording-settings", async () => {
    try {
      await appState.openScreenRecordingSettings()
    } catch (error: any) {
      console.error("Error opening screen recording settings:", error)
    }
  })

  ipcMain.handle("check-screen-recording-permission", async () => {
    try {
      return await appState.checkScreenRecordingPermission()
    } catch (error: any) {
      console.error("Error checking screen recording permission:", error)
      return false
    }
  })

  ipcMain.handle("quit-app", () => {
    app.quit()
  })
}
