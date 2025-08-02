import { createWorker } from 'tesseract.js'
import { ScreenshotHelper } from './ScreenshotHelper'
import { PermissionsHelper } from './PermissionsHelper'
import path from 'path'
import fs from 'fs'

export interface ContextData {
  software: string
  confidence: number
  panels: string[]
  text_content: string
  screenshot_path: string
  ui_elements: string[]
}

export class ContextHelper {
  private screenshotHelper: ScreenshotHelper
  private ocrWorker: any = null

  constructor(screenshotHelper: ScreenshotHelper) {
    this.screenshotHelper = screenshotHelper
  }

  private async initializeOCR() {
    if (!this.ocrWorker) {
      console.log('[ContextHelper] Initializing OCR worker...')
      this.ocrWorker = await createWorker()
      await this.ocrWorker.loadLanguage('eng')
      await this.ocrWorker.initialize('eng')
      console.log('[ContextHelper] OCR worker ready')
    }
  }

  private detectCreativeSoftware(text: string): { software: string; confidence: number } {
    const softwarePatterns = [
      { name: 'Adobe Premiere Pro', patterns: ['premiere', 'timeline', 'lumetri', 'essential graphics', 'sequence'] },
      { name: 'DaVinci Resolve', patterns: ['davinci', 'resolve', 'color', 'fusion', 'fairlight', 'deliver'] },
      { name: 'Adobe Photoshop', patterns: ['photoshop', 'layers', 'brush', 'filter', 'adjustment'] },
      { name: 'Adobe After Effects', patterns: ['after effects', 'composition', 'timeline', 'effects', 'precomp'] },
      { name: 'Adobe Illustrator', patterns: ['illustrator', 'artboard', 'pen tool', 'pathfinder', 'stroke'] },
      { name: 'Final Cut Pro', patterns: ['final cut', 'event', 'project', 'blade', 'magnetic timeline'] },
      { name: 'Adobe Lightroom', patterns: ['lightroom', 'develop', 'library', 'histogram', 'tone curve'] },
      { name: 'Logic Pro', patterns: ['logic pro', 'track area', 'mixer', 'library', 'score editor'] }
    ]

    const lowerText = text.toLowerCase()
    let bestMatch = { software: 'Unknown', confidence: 0 }

    for (const sw of softwarePatterns) {
      let matches = 0
      for (const pattern of sw.patterns) {
        if (lowerText.includes(pattern)) {
          matches++
        }
      }
      
      const confidence = matches / sw.patterns.length
      if (confidence > bestMatch.confidence) {
        bestMatch = { software: sw.name, confidence }
      }
    }

    return bestMatch
  }

  private extractUIElements(text: string): string[] {
    const uiPatterns = [
      // Common UI elements
      'timeline', 'inspector', 'browser', 'viewer', 'canvas', 'toolbar', 'panel', 'window',
      
      // Premiere Pro specific
      'program monitor', 'source monitor', 'project panel', 'effect controls', 'lumetri color',
      'essential graphics', 'essential sound', 'sequence', 'media browser',
      
      // DaVinci Resolve specific
      'media pool', 'timeline viewer', 'inspector panel', 'color wheels', 'nodes', 'gallery',
      'scopes', 'mixer', 'fairlight', 'fusion page', 'edit page', 'color page',
      
      // Photoshop specific
      'layers panel', 'properties panel', 'history panel', 'brush panel', 'color panel',
      'channels', 'paths', 'adjustment layers', 'filter gallery',
      
      // After Effects specific
      'composition panel', 'project panel', 'timeline panel', 'effect controls panel',
      'character panel', 'paragraph panel', 'align panel', 'tracker panel',
      
      // General editing terms
      'play', 'pause', 'stop', 'record', 'zoom', 'scale', 'rotate', 'position',
      'opacity', 'blend mode', 'mask', 'keyframe', 'transition', 'effect'
    ]

    const lowerText = text.toLowerCase()
    const foundElements: string[] = []

    for (const element of uiPatterns) {
      if (lowerText.includes(element)) {
        foundElements.push(element)
      }
    }

    return [...new Set(foundElements)] // Remove duplicates
  }

  private extractPanels(text: string): string[] {
    const panelPatterns = [
      'project panel', 'timeline panel', 'program monitor', 'source monitor',
      'effect controls', 'lumetri color', 'essential graphics', 'essential sound',
      'media pool', 'inspector', 'color wheels', 'scopes', 'mixer',
      'layers panel', 'properties panel', 'history panel', 'tools panel',
      'color panel', 'swatches panel', 'brush panel', 'character panel'
    ]

    const lowerText = text.toLowerCase()
    const foundPanels: string[] = []

    for (const panel of panelPatterns) {
      if (lowerText.includes(panel)) {
        foundPanels.push(panel)
      }
    }

    return foundPanels
  }

  public async captureAndAnalyzeContext(): Promise<ContextData> {
    try {
      console.log('[ContextHelper] Capturing screen context...')
      
      // Check if we have screen recording permission on macOS
      const hasPermission = await PermissionsHelper.handlePermissionForContextCapture()
      
      if (!hasPermission && process.platform === 'darwin') {
        console.log('[ContextHelper] Screen recording permission required on macOS')
        return {
          software: 'Permission Required',
          confidence: 0,
          panels: [],
          text_content: 'Screen recording permission needed for context detection. Please enable in System Preferences → Privacy & Security → Screen Recording.',
          screenshot_path: '',
          ui_elements: []
        }
      }
      
      // Take a screenshot using the existing screenshot helper
      const screenshotPath = await this.screenshotHelper.takeScreenshot(
        () => {}, // No need to hide window for context capture
        () => {}  // No need to show window for context capture
      )

      console.log('[ContextHelper] Screenshot captured:', screenshotPath)

      // Initialize OCR if needed
      await this.initializeOCR()

      // Perform OCR on the screenshot
      console.log('[ContextHelper] Running OCR analysis...')
      const { data: { text } } = await this.ocrWorker.recognize(screenshotPath)

      console.log('[ContextHelper] OCR completed, analyzing context...')

      // Analyze the extracted text
      const softwareDetection = this.detectCreativeSoftware(text)
      const panels = this.extractPanels(text)
      const uiElements = this.extractUIElements(text)

      const contextData: ContextData = {
        software: softwareDetection.software,
        confidence: softwareDetection.confidence,
        panels,
        text_content: text.slice(0, 500), // Limit text for performance
        screenshot_path: screenshotPath,
        ui_elements: uiElements
      }

      console.log('[ContextHelper] Context analysis complete:', {
        software: contextData.software,
        confidence: contextData.confidence,
        panels: contextData.panels.length,
        ui_elements: contextData.ui_elements.length
      })

      return contextData

    } catch (error) {
      console.error('[ContextHelper] Error capturing context:', error)
      return {
        software: 'Unknown',
        confidence: 0,
        panels: [],
        text_content: '',
        screenshot_path: '',
        ui_elements: []
      }
    }
  }

  public async cleanup() {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate()
      this.ocrWorker = null
      console.log('[ContextHelper] OCR worker terminated')
    }
  }
} 