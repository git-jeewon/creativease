import React, { useState, useEffect, useRef } from "react"
import { IoLogOutOutline } from "react-icons/io5"

interface QueueCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void
  screenshots: Array<{ path: string; preview: string }>
}

const QueueCommands: React.FC<QueueCommandsProps> = ({
  onTooltipVisibilityChange,
  screenshots
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioResult, setAudioResult] = useState<string | null>(null)
  const [coachGuidance, setCoachGuidance] = useState<{ steps: string[]; highlights: string[]; learn_more_url: string } | null>(null)
  const [isCoachRecording, setIsCoachRecording] = useState(false)
  const [transcribedText, setTranscribedText] = useState<string>("")
  const [textInput, setTextInput] = useState<string>("")
  const [isProcessingGuidance, setIsProcessingGuidance] = useState(false)
  const chunks = useRef<Blob[]>([])

  useEffect(() => {
    let tooltipHeight = 0
    if (tooltipRef.current && isTooltipVisible) {
      tooltipHeight = tooltipRef.current.offsetHeight + 10
    }
    onTooltipVisibilityChange(isTooltipVisible, tooltipHeight)
  }, [isTooltipVisible])

  // Listen for CreativEase Coach shortcut (Cmd+Shift+E)
  useEffect(() => {
    const cleanup = window.electronAPI.onStartCreativeCoachRecording(() => {
      console.log("CreativEase Coach triggered via shortcut!")
      startCoachRecording()
    })
    return cleanup
  }, [])

  const handleMouseEnter = () => {
    setIsTooltipVisible(true)
  }

  const handleMouseLeave = () => {
    setIsTooltipVisible(false)
  }

  const handleRecordClick = async () => {
    if (!isRecording) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream)
        recorder.ondataavailable = (e) => chunks.current.push(e.data)
        recorder.onstop = async () => {
          const blob = new Blob(chunks.current, { type: chunks.current[0]?.type || 'audio/webm' })
          chunks.current = []
          const reader = new FileReader()
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1]
            try {
              const result = await window.electronAPI.analyzeAudioFromBase64(base64Data, blob.type)
              setAudioResult(result.text)
            } catch (err) {
              setAudioResult('Audio analysis failed.')
            }
          }
          reader.readAsDataURL(blob)
        }
        setMediaRecorder(recorder)
        recorder.start()
        setIsRecording(true)
      } catch (err) {
        setAudioResult('Could not start recording.')
      }
    } else {
      // Stop recording
      mediaRecorder?.stop()
      setIsRecording(false)
      setMediaRecorder(null)
    }
  }

  // Get guidance from text (shared function for voice and text input)
  const getGuidanceFromText = async (text: string) => {
    if (!text.trim()) return
    
    try {
      setIsProcessingGuidance(true)
      setCoachGuidance(null)
      
      console.log("Getting CreativEase Coach guidance for:", text)
      
      // Use the new text-based method
      const guidance = await window.electronAPI.getCreativeGuidanceFromText(text)
      setCoachGuidance(guidance)
    } catch (err) {
      console.error("Coach guidance failed:", err)
      setCoachGuidance({
        steps: ["Sorry, CreativEase Coach had an error processing your request."],
        highlights: [],
        learn_more_url: ""
      })
    } finally {
      setIsProcessingGuidance(false)
    }
  }

  // CreativEase Coach recording function (now with transcription display)
  const startCoachRecording = async () => {
    if (isCoachRecording) return // Prevent double recording
    
    try {
      setIsCoachRecording(true)
      setCoachGuidance(null) // Clear previous guidance
      setTranscribedText("") // Clear previous transcription
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const coachChunks: Blob[] = []
      
      recorder.ondataavailable = (e) => coachChunks.push(e.data)
      recorder.onstop = async () => {
        const blob = new Blob(coachChunks, { type: coachChunks[0]?.type || 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1]
          try {
            // Step 1: Transcribe the audio to text
            console.log("Transcribing audio...")
            const transcription = await window.electronAPI.analyzeAudioFromBase64(base64Data, blob.type)
            setTranscribedText(transcription.text)
            
            // Step 2: Get guidance from the transcribed text
            await getGuidanceFromText(transcription.text)
            
          } catch (err) {
            console.error("Coach transcription/guidance failed:", err)
            setTranscribedText("Could not transcribe audio.")
            setCoachGuidance({
              steps: ["Sorry, CreativEase Coach had an error processing your request."],
              highlights: [],
              learn_more_url: ""
            })
          }
        }
        reader.readAsDataURL(blob)
        setIsCoachRecording(false)
      }
      
      recorder.start()
      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop()
        }
      }, 5000)
      
    } catch (err) {
      console.error("Coach recording error:", err)
      setIsCoachRecording(false)
      setCoachGuidance({
        steps: ["Could not start voice recording. Please check microphone permissions."],
        highlights: [],
        learn_more_url: ""
      })
    }
  }

  // Handle text input submission
  const handleTextSubmit = () => {
    if (textInput.trim()) {
      setTranscribedText(textInput.trim())
      getGuidanceFromText(textInput.trim())
      setTextInput("") // Clear input after submission
    }
  }

  return (
    <div className="pt-2 w-fit">
      <div className="text-xs text-white/90 backdrop-blur-md bg-black/60 rounded-lg py-2 px-4 flex items-center justify-center gap-4">
        {/* Show/Hide */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] leading-none">Show/Hide</span>
          <div className="flex gap-1">
            <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
              ⌘
            </button>
            <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
              B
            </button>
          </div>
        </div>

        {/* Screenshot */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] leading-none truncate">
            {screenshots.length === 0 ? "Take first screenshot" : "Screenshot"}
          </span>
          <div className="flex gap-1">
            <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
              ⌘
            </button>
            <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
              H
            </button>
          </div>
        </div>

        {/* Solve Command */}
        {screenshots.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] leading-none">Solve</span>
            <div className="flex gap-1">
              <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                ⌘
              </button>
              <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                ↵
              </button>
            </div>
          </div>
        )}

        {/* Voice Recording Button */}
        <div className="flex items-center gap-2">
          <button
            className={`bg-white/10 hover:bg-white/20 transition-colors rounded-md px-2 py-1 text-[11px] leading-none text-white/70 flex items-center gap-1 ${isRecording ? 'bg-red-500/70 hover:bg-red-500/90' : ''}`}
            onClick={handleRecordClick}
            type="button"
          >
            {isRecording ? (
              <span className="animate-pulse">● Stop Recording</span>
            ) : (
              <span>🎤 Record Voice</span>
            )}
          </button>
        </div>

        {/* CreativEase Coach Button */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] leading-none">Coach</span>
          <div className="flex gap-1">
            <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
              ⌘
            </button>
            <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
              ⇧
            </button>
            <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
              E
            </button>
          </div>
        </div>

        {/* Text Input for Coach */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
            placeholder="Or type your creative question..."
            className="bg-white/10 border border-white/20 rounded-md px-2 py-1 text-[11px] text-white placeholder-white/50 focus:bg-white/20 focus:border-white/40 outline-none"
            style={{ width: '200px' }}
          />
          <button
            onClick={handleTextSubmit}
            disabled={!textInput.trim() || isProcessingGuidance}
            className="bg-blue-500/70 hover:bg-blue-500/90 disabled:bg-white/10 disabled:text-white/30 transition-colors rounded-md px-2 py-1 text-[11px] leading-none text-white"
          >
            Ask
          </button>
        </div>

        {/* Question mark with tooltip */}
        <div
          className="relative inline-block"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors flex items-center justify-center cursor-help z-10">
            <span className="text-xs text-white/70">?</span>
          </div>

          {/* Tooltip Content */}
          {isTooltipVisible && (
            <div
              ref={tooltipRef}
              className="absolute top-full right-0 mt-2 w-80"
            >
              <div className="p-3 text-xs bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-white/90 shadow-lg">
                <div className="space-y-4">
                  <h3 className="font-medium truncate">Keyboard Shortcuts</h3>
                  <div className="space-y-3">
                    {/* Toggle Command */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate">Toggle Window</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            ⌘
                          </span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            B
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-white/70 truncate">
                        Show or hide this window.
                      </p>
                    </div>
                    {/* Screenshot Command */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate">Take Screenshot</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            ⌘
                          </span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            H
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-white/70 truncate">
                        Take a screenshot of the problem description. The tool
                        will extract and analyze the problem. The 5 latest
                        screenshots are saved.
                      </p>
                    </div>

                    {/* Solve Command */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate">Solve Problem</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            ⌘
                          </span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            ↵
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-white/70 truncate">
                        Generate a solution based on the current problem.
                      </p>
                    </div>

                    {/* CreativEase Coach Command */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate">CreativEase Coach</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            ⌘
                          </span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            ⇧
                          </span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            E
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-white/70 truncate">
                        Ask for instant creative workflow guidance. Say things like "How do I color grade in DaVinci?" or "Fix audio sync in Premiere".
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="mx-2 h-4 w-px bg-white/20" />

        {/* Sign Out Button - Moved to end */}
        <button
          className="text-red-500/70 hover:text-red-500/90 transition-colors hover:cursor-pointer"
          title="Sign Out"
          onClick={() => window.electronAPI.quitApp()}
        >
          <IoLogOutOutline className="w-4 h-4" />
        </button>
      </div>
      {/* Audio Result Display */}
      {audioResult && (
        <div className="mt-2 p-2 bg-white/10 rounded text-white text-xs max-w-md">
          <span className="font-semibold">Audio Result:</span> {audioResult}
        </div>
      )}

      {/* CreativEase Coach Guidance Display */}
      {isCoachRecording && (
        <div className="mt-2 p-3 bg-blue-500/20 rounded-lg text-white text-xs max-w-md border border-blue-500/30">
          <div className="flex items-center gap-2">
            <span className="animate-pulse text-blue-400">●</span>
            <span className="font-semibold text-blue-300">CreativEase Coach listening...</span>
          </div>
        </div>
      )}

      {isProcessingGuidance && (
        <div className="mt-2 p-3 bg-yellow-500/20 rounded-lg text-white text-xs max-w-md border border-yellow-500/30">
          <div className="flex items-center gap-2">
            <span className="animate-spin text-yellow-400">⟳</span>
            <span className="font-semibold text-yellow-300">Getting guidance...</span>
          </div>
        </div>
      )}

      {/* Show transcribed text when available */}
      {transcribedText && (
        <div className="mt-2 p-3 bg-purple-500/20 rounded-lg text-white text-xs max-w-md border border-purple-500/30">
          <div className="space-y-2">
            <h4 className="font-semibold text-purple-300 flex items-center gap-2">
              🎤 You asked:
            </h4>
            <p className="text-white/90 italic leading-relaxed">"{transcribedText}"</p>
          </div>
        </div>
      )}

      {coachGuidance && (
        <div className="mt-2 p-3 bg-green-500/20 rounded-lg text-white text-xs max-w-md border border-green-500/30">
          <div className="space-y-3">
            <h4 className="font-semibold text-green-300 flex items-center gap-2">
              🎨 CreativEase Coach
            </h4>
            
            {coachGuidance.steps.length > 0 && (
              <div>
                <p className="font-medium text-green-200 mb-1">Steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-white/90">
                  {coachGuidance.steps.map((step, index) => (
                    <li key={index} className="text-[11px] leading-relaxed">{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {coachGuidance.highlights.length > 0 && (
              <div>
                <p className="font-medium text-green-200 mb-1">Focus on:</p>
                <ul className="list-disc list-inside space-y-1 text-white/90">
                  {coachGuidance.highlights.map((highlight, index) => (
                    <li key={index} className="text-[11px] leading-relaxed">{highlight}</li>
                  ))}
                </ul>
              </div>
            )}

            {coachGuidance.learn_more_url && (
              <div>
                <a 
                  href={coachGuidance.learn_more_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-300 hover:text-blue-200 underline text-[11px]"
                >
                  📖 Learn More
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default QueueCommands
