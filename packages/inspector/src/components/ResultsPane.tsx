import { useEffect, useState } from 'react'
import { Monitor, FileText, Clock, AlertTriangle, Maximize2, Minimize2, RotateCw } from 'lucide-react'
import { Button } from './Button'
import type { ToolResult } from '../App'
import './ResultsPane.css'

interface ResultsPaneProps {
  result: ToolResult | null
  isExecuting: boolean
  onReload?: () => void
}

type Tab = 'ui' | 'text'

export function ResultsPane({ result, isExecuting, onReload }: ResultsPaneProps) {
  const [activeTab, setActiveTab] = useState<Tab>('ui')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const hasUI = result?.htmlContent != null
  const hasText = result?.textContent != null

  useEffect(() => {
    if (hasUI) {
      setActiveTab('ui')
    } else if (hasText) {
      setActiveTab('text')
    }
  }, [hasText, hasUI])

  return (
    <div className={`results-pane ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="panel-header">
        <div className="results-tabs">
          <button
            className={`tab ${activeTab === 'ui' ? 'active' : ''}`}
            onClick={() => setActiveTab('ui')}
          >
            <Monitor size={14} />
            UI
            <span className={`tab-badge ${hasUI ? 'active' : ''}`} />
          </button>
          <button
            className={`tab ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            <FileText size={14} />
            Text
            <span className={`tab-badge ${hasText ? 'active' : ''}`} />
          </button>
        </div>

        <div className="results-actions">
          {result?.timestamp && (
            <span className="timestamp">
              <Clock size={12} />
              {result.timestamp.toLocaleTimeString()}
            </span>
          )}
          {onReload && (
            <Button
              variant="ghost"
              onClick={onReload}
              disabled={isExecuting}
              title="Reload"
              icon={<RotateCw size={14} />}
            />
          )}
          <Button
            variant="ghost"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            icon={isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          />
        </div>
      </div>

      <div className="results-content">
        {isExecuting ? (
          <div className="results-loading">
            <div className="loader"></div>
            <p>Executing tool...</p>
          </div>
        ) : !result ? (
          <div className="results-empty">
            <Monitor size={48} strokeWidth={1} />
            <p>Execute a tool to see results</p>
          </div>
        ) : result.isError ? (
          <div className="results-error">
            <AlertTriangle size={24} />
            <p>Error</p>
            <pre>{result.textContent}</pre>
          </div>
        ) : activeTab === 'ui' ? (
          hasUI ? (
            <iframe
              className="ui-frame"
              srcDoc={result.htmlContent!}
              title="Tool UI Output"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="results-empty">
              <Monitor size={48} strokeWidth={1} />
              <p>No UI output returned</p>
              <span>This tool may only return text content</span>
            </div>
          )
        ) : (
          <div className="text-output">
            <pre>{result.textContent || 'No text content'}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
