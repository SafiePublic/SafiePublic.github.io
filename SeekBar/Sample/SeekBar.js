const HEIGHT = 120;
const SEEKBAR_POS_Y = 60;
const SEEKBAR_HEIGHT = 15;
const SCALE_HEIGHT = 16;
const SCALE_TIME_TEXT_SIZE = 16;
const CURRENT_TIME_TEXT_SIZE = 28;
const SEEKBAR_DATA_COLOR = '#393';
const SEEKBAR_BLANK_COLOR = '#999';
const SEEKBAR_SCALE_COLOR = '#000000';
const SEEKBAR_BACKGROUND_COLOR = '#FFFFFF';
const SEEKBAR_CENTER_LINE_COLOR = '#FF0000';
const SEEKBAR_TIME_TEXT_COLOR = '#FF0000';
const MIN_TIME_MS_PER_PIX = 10;

class SeekBar {
  // DOM 要素
  parentDom = null;
  canvas = null;

  // 現在の時刻
  currentTimeMs = 0;

  // 1ピクセルあたりの時間（ミリ秒）
  timeMsPerPix = 2400;

  // 動画の長さ（ミリ秒）
  durationMs = 2 * 60 * 60 * 1000

  // マウスイベント
  isMouseDown = false
  mousePosX = 0

  // タッチイベント
  touches = []

  constructor(domElement) {
    this.parentDom = domElement;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.parentDom.clientWidth;
    this.canvas.height = this.parentDom.clientHeight;
    this.parentDom.appendChild(this.canvas);

    this.canvas.addEventListener('mousedown', (e) => {
      this.isMouseDown = true
      this.mousePosX = e.offsetX
    })

    this.canvas.addEventListener('mouseup', () => {
      this.isMouseDown = false
    })

    this.canvas.addEventListener('mouseleave', () => {
      this.isMouseDown = false
    })

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isMouseDown) {
        const prevMousePosX = this.mousePosX
        this.mousePosX = e.offsetX
        const diffX = prevMousePosX - this.mousePosX
        const newCurrentTime = this.currentTimeMs + diffX * this.timeMsPerPix
        this.currentTimeMs = Math.max(0, Math.min(this.durationMs, newCurrentTime))
        this.draw()
      }
    })

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      let newTimeMsPerPix = this.timeMsPerPix
      if (e.deltaY > 0) {
        newTimeMsPerPix *= 1.1
      }else{
        newTimeMsPerPix *= 0.9
      }
      this.timeMsPerPix = Math.max(MIN_TIME_MS_PER_PIX, newTimeMsPerPix)
      this.draw()
    })

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const canvasRect = this.canvas.getClientRects()[0]
      const newTouches = []
      for (let i = 0; e.touches.length > i; ++i) {
        newTouches.push({
          x: e.touches[i].clientX - canvasRect.left,
          y: e.touches[i].clientY - canvasRect.top,
        })
      }

      if (this.touches.length !== newTouches.length) {
        this.touches = newTouches
        return
      }       
      
      const prevTouchMeanPos = { x:0, y:0 }
      const newTouchMeanPos = { x:0, y:0 }
      for (let i = 0; this.touches.length > i; ++i) {
        prevTouchMeanPos.x += this.touches[i].x
        prevTouchMeanPos.y += this.touches[i].y
        newTouchMeanPos.x += newTouches[i].x
        newTouchMeanPos.y += newTouches[i].y
      }
      prevTouchMeanPos.x /= this.touches.length
      prevTouchMeanPos.y /= this.touches.length
      newTouchMeanPos.x /= newTouches.length
      newTouchMeanPos.y /= newTouches.length
          
      const diffX = prevTouchMeanPos.x - newTouchMeanPos.x
      const newCurrentTime = this.currentTimeMs + diffX * this.timeMsPerPix
      this.currentTimeMs = Math.max(0, Math.min(this.durationMs - 0.1, newCurrentTime))

      if (this.touches.length >= 2) {
        let prevMaxDistance = 0
        for (let i = 0; this.touches.length > i; ++i) {
          for (let j = i+1; this.touches.length > j; ++j) {
            const p1 = this.touches[i]
            const p2 = this.touches[j]
            prevMaxDistance = Math.max(prevMaxDistance, this.calcDistance(p1, p2))
          }
        }
        let newMaxDistance = 0
        for (let i = 0; newTouches.length > i; ++i) {
          for (let j = i+1; newTouches.length > j; ++j) {
            const p1 = newTouches[i]
            const p2 = newTouches[j]
            newMaxDistance = Math.max(newMaxDistance, this.calcDistance(p1, p2))
          }
        }

        const newTimeMsPerPix = this.timeMsPerPix * prevMaxDistance / newMaxDistance 
        this.timeMsPerPix = Math.max(MIN_TIME_MS_PER_PIX, newTimeMsPerPix)
      }

      this.draw()

      this.touches = newTouches
    })

    this.canvas.addEventListener('touchend', (e) => {
      this.touches = []
    })

    window.addEventListener('resize', () => {
      this.resize();
    })

    this.draw();
  }


  resize() {
    this.canvas.width = this.parentDom.clientWidth;
    this.canvas.height = HEIGHT;
    this.draw();
  }

  draw() {
    const ctx = this.canvas.getContext('2d');

    // 背景を描画
    ctx.fillStyle = SEEKBAR_BACKGROUND_COLOR;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // タイムラインのバーを描画
    ctx.fillStyle = SEEKBAR_BLANK_COLOR;
    ctx.fillRect(0, SEEKBAR_POS_Y, this.canvas.width, SEEKBAR_HEIGHT);
    const dataStartPosX = this.time2pix(0)
    const dataEndPosX = this.time2pix(this.durationMs)
    ctx.fillStyle = SEEKBAR_DATA_COLOR;
    ctx.fillRect(dataStartPosX, SEEKBAR_POS_Y, dataEndPosX - dataStartPosX, SEEKBAR_HEIGHT);

    // タイムラインのスケールを描画
    ctx.font = SCALE_TIME_TEXT_SIZE + 'px sans-serif';
    const { scaleInterval, textInterval } = this.adjustScale(this.timeMsPerPix)
    const startTime = this.pix2time(0)
    const endTime = this.pix2time(this.canvas.width)
    const firstScaleTime = Math.floor(startTime / scaleInterval) * scaleInterval
    let i = 0
    while (1) {
      const scaleTime = firstScaleTime + i * scaleInterval
      if (scaleTime > endTime) {
        break;
      }

      if (scaleTime > this.durationMs) {
        break;
      }

      if (scaleTime < 0) {
        i++
        continue
      }

      // スケールの目盛りを描画
      const scalePosX = this.time2pix(scaleTime)
      const scalePosStartY = SEEKBAR_POS_Y + SEEKBAR_HEIGHT
      const scalePosEndY = scaleTime % textInterval === 0 ? 
        scalePosStartY + SCALE_HEIGHT : 
        scalePosStartY + SCALE_HEIGHT / 2
      ctx.fillStyle = SEEKBAR_SCALE_COLOR;
      ctx.fillRect(scalePosX, scalePosStartY, 1, scalePosEndY - scalePosStartY)

      // スケールの時間を描画
      if (scaleTime % textInterval === 0) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(this.time2str(scaleTime), scalePosX, scalePosEndY + 5)
      }

      i++
    }

    // 中心の線を描画
    ctx.fillStyle = SEEKBAR_CENTER_LINE_COLOR;
    ctx.fillRect(this.canvas.width / 2, 0, 1, this.canvas.height);    

    // 現在時刻の文字背景を塗りつぶす
    const textBgWidth = 100
    const textBgHeight = CURRENT_TIME_TEXT_SIZE + 5
    const textBgPosX = (this.canvas.width - textBgWidth) / 2
    const textBgPosY = (SEEKBAR_POS_Y - textBgHeight) / 2
    ctx.fillStyle = SEEKBAR_BACKGROUND_COLOR;
    ctx.fillRect(textBgPosX, textBgPosY, textBgWidth, textBgHeight);

    // 現在時刻のテキストを描画
    ctx.font = CURRENT_TIME_TEXT_SIZE + 'px sans-serif';
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'    
    ctx.fillStyle = SEEKBAR_TIME_TEXT_COLOR;
    const textPosX = this.canvas.width / 2
    const textPosY = SEEKBAR_POS_Y / 2
    ctx.fillText(this.time2str(this.currentTimeMs), textPosX, textPosY);
  }

  pix2time(pix) {
    const startTimeMs = this.currentTimeMs - this.canvas.width / 2 * this.timeMsPerPix;
    return pix * this.timeMsPerPix + startTimeMs;
  }

  time2pix(timeMs) {
    const startTimeMs = this.currentTimeMs - this.canvas.width / 2 * this.timeMsPerPix;
    return (timeMs - startTimeMs) / this.timeMsPerPix
  }

  time2str(timeMs) {
    const HOUR_MS = 60 * 60 * 1000
    const MIN_MS = 60 * 1000
    const SEC_MS = 1000
    const hour = Math.floor(timeMs / HOUR_MS).toString()
    const min = Math.floor((timeMs - hour*HOUR_MS) / MIN_MS).toString().padStart(2, '0')
    const sec = Math.floor((timeMs - hour*HOUR_MS - min*MIN_MS) / SEC_MS).toString().padStart(2, '0')
    return hour + ':' + min + ':' + sec
  }

  adjustScale(timeMsPerPix) {
    const map = [
      { timePerPix:14,     scaleInterval:100,        textInterval:1000,  },
      { timePerPix:50,     scaleInterval:1000,       textInterval:5*1000,  },
      { timePerPix:120,    scaleInterval:1000,       textInterval:10*1000, },
      { timePerPix:240,    scaleInterval:1000*5,     textInterval:30*1000, },
      { timePerPix:700,    scaleInterval:1000*10,    textInterval:60*1000, },
      { timePerPix:2500,   scaleInterval:1000*30,    textInterval:5*60*1000, },
      { timePerPix:8000,   scaleInterval:1000*60,    textInterval:10*60*1000, },
      { timePerPix:24000,  scaleInterval:1000*60*5,  textInterval:30*60*1000, },
      { timePerPix:80000,  scaleInterval:1000*60*10, textInterval:60*60*1000, },
      { timePerPix:120000, scaleInterval:1000*60*60, textInterval:3*60*60*1000 },
      { timePerPix:400000, scaleInterval:1000*60*60, textInterval:6*60*60*1000 },
    ]
  
    for (const m of map) {
      if(m.timePerPix > timeMsPerPix) {
        return {
          scaleInterval: m.scaleInterval,
          textInterval: m.textInterval,
        }
      }
    }
  
    return {
      scaleInterval: 1000*60*60,
      textInterval: 6*60*60*1000,
    }
  }  

  calcDistance(p1, p2) {
    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    return Math.sqrt(dx * dx + dy * dy)
  }
}