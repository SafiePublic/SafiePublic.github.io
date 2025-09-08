const TIMELINE_HEIGHT = 100;
const THUMBNAIL_IMAGE_MARGIN = 8;
const THUMBNAIL_IMAGE_HEIGHT = 40;
const TIMELINE_BAR_POS_Y = THUMBNAIL_IMAGE_HEIGHT + THUMBNAIL_IMAGE_MARGIN * 2; 
const TIMELINE_BAR_HEIGHT = 9;
const TIMELINE_SCALE_HEIGHT = 6;
const TIMELINE_BAR_DATA_COLOR = '#393';
const TIMELINE_BAR_BLANK_COLOR = '#999';
const TIMELINE_SCALE_COLOR = '#000000';
const TIMELINE_BACKGROUND_COLOR = '#FFFFFF';
const TIMELINE_CETER_LINE_COLOR = '#FF0000';
const TIMELINE_TIME_TEXT_COLOR = '#FF0000';
const VIDEO_BACKGROUND_COLOR = '#000000';
const THUMBNAIL_BACKGROUND_COLOR = '#DDDDDD';
const SCALE_TIME_STR_SIZE = 10;
const CURRENT_TIME_STR_SIZE = 20;
const MIN_TIME_MS_PER_PIX = 10;

class MoviePlayerImpl {
  dom = null;
  canvas = null;
  video = null;
  isLoaded = false;
  videoTimerId = null;
  videoForThumbnail = null;
  thumbnailImageList = [];
  isThumbnailLoadProcessLocked = false;

  playButton = null;
  isPlaying = false;
  volumeSlider = null;

  currentTimeMs = 0;
  timeMsPerPix = 45;
  maxTimeMsPerPix = 10000;
  
  isMouseDown = false
  mousePosX = 0
  mouseMoveTimerId = null
  touches = []

  constructor(domElement) {
    this.parentDom = domElement;
    this.dom = document.createElement('div');
    this.dom.style.width = '100%';
    this.dom.style.height = '100%';
    this.dom.style.position = 'relative';
    this.parentDom.appendChild(this.dom);

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.parentDom.clientWidth;
    this.canvas.height = this.parentDom.clientHeight;
    this.dom.appendChild(this.canvas);

    this.playButton = document.createElement('button');
    this.playButton.textContent = 'Play';
    this.playButton.style.fontSize = '24px';
    this.playButton.style.bottom = (TIMELINE_HEIGHT + 20) + 'px';
    this.playButton.style.left = '20px';
    this.playButton.style.position = 'absolute';
    this.playButton.style.visibility = 'hidden';
    this.playButton.style.backgroundColor = '#3434ac';
    this.playButton.style.color = '#ffffff';
    this.playButton.style.border = 'none';
    this.playButton.style.padding = '8px 16px';
    this.playButton.style.borderRadius = '5px';
    this.playButton.style.cursor = 'pointer';
    this.dom.appendChild(this.playButton);

    this.volumeSlider = document.createElement('input');
    this.volumeSlider.type = 'range';
    this.volumeSlider.min = 0;
    this.volumeSlider.max = 1;
    this.volumeSlider.step = 0.01;
    this.volumeSlider.style.position = 'absolute';
    this.volumeSlider.style.visibility = 'hidden';
    this.volumeSlider.style.bottom = (TIMELINE_HEIGHT + 20) + 'px';
    this.volumeSlider.style.right = '20px';
    this.volumeSlider.style.width = '160px';
    this.volumeSlider.style.cursor = 'pointer';
    this.dom.appendChild(this.volumeSlider);
    this.volumeSlider.addEventListener('input', () => {
      if (this.video) {
        this.video.volume = this.volumeSlider.value;
      }
    });

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
      if (this.isMouseDown && this.video) {
        const prevMousePosX = this.mousePosX
        this.mousePosX = e.offsetX
        const diffX = prevMousePosX - this.mousePosX
        const newCurrentTime = this.video.currentTime + diffX * this.timeMsPerPix / 1000
        this.video.currentTime = Math.max(0, Math.min(this.video.duration - 0.1, newCurrentTime))
        this.video.pause();
        this.updateThumbnail();
        this.draw()
      }

      if (this.mouseMoveTimerId !== null) {
        clearTimeout(this.mouseMoveTimerId);
      }
      if (this.video) {
        this.playButton.style.visibility = 'visible';
        this.volumeSlider.style.visibility = 'visible';
        this.mouseMoveTimerId = setTimeout(() => {
          this.playButton.style.visibility = 'hidden';
          this.volumeSlider.style.visibility = 'hidden';
          this.mouseMoveTimerId = null;
        }, 5000);
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
      this.timeMsPerPix = Math.min(Math.max(MIN_TIME_MS_PER_PIX, newTimeMsPerPix), this.maxTimeMsPerPix)
      this.updateThumbnail();
      this.draw()
    })
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.video) {
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
        const newCurrentTime = this.video.currentTime + diffX * this.timeMsPerPix / 1000
        this.video.currentTime = Math.max(0, Math.min(this.video.duration - 0.1, newCurrentTime))

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
          this.timeMsPerPix = Math.min(Math.max(MIN_TIME_MS_PER_PIX, newTimeMsPerPix), this.maxTimeMsPerPix)
        }

        this.video.pause();
        this.updateThumbnail();
        this.draw()

        this.touches = newTouches
      }

      if (this.mouseMoveTimerId !== null) {
        clearTimeout(this.mouseMoveTimerId);
      }
      if (this.video) {
        this.playButton.style.visibility = 'visible';
        this.volumeSlider.style.visibility = 'visible';
        this.mouseMoveTimerId = setTimeout(() => {
          this.playButton.style.visibility = 'hidden';
          this.volumeSlider.style.visibility = 'hidden';
          this.mouseMoveTimerId = null;
        }, 5000);
      }      
    })
    this.canvas.addEventListener('touchend', (e) => {
      this.touches = []
    })
  
    this.playButton.addEventListener('click', () => {
      if (this.video.paused) {
        this.playButton.textContent = 'Pause';
        this.play();
      } else {
        this.pause();
      }
    });

    window.addEventListener('resize', () => {
      this.resize();
    })

    this.draw();
  }

  async load(file) {
    this.isLoaded = false;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        await this.setSrc(e.target.result);
        resolve();
      };
      reader.readAsDataURL(file);    
    })
  }

  async setSrc(src) {
    this.isLoaded = false;
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.addEventListener('loadedmetadata', () => {
      // 500 pixで動画全体が表示されるようにする
      this.maxTimeMsPerPix = this.video.duration * 1000 / 500
      this.updateThumbnail()
    });
    this.video.addEventListener('canplay', () => {
      this.isLoaded = true;
      if (this.isPlaying) {
        this.play();
      }else{
        this.draw()
      }
    });
    this.video.addEventListener('ended', () => {
      this.pause()
    });
    this.video.addEventListener('error', (e) => {
      this.isLoaded = true;
      window.alert('Error: Failed to load video');
      console.error(e);
    })
    this.video.src = src;

    this.videoForThumbnail = document.createElement('video');
    this.videoForThumbnail.addEventListener('seeked', () => {
      // console.log('seeked', this.videoForThumbnail.currentTime)
      const viedoWidth = this.videoForThumbnail.videoWidth;
      const videoHeight = this.videoForThumbnail.videoHeight;
      const canvas = document.createElement('canvas');
      canvas.height = THUMBNAIL_IMAGE_HEIGHT;
      canvas.width = THUMBNAIL_IMAGE_HEIGHT * viedoWidth / videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.videoForThumbnail, 0, 0, canvas.width, canvas.height);
      const currentTime = this.videoForThumbnail.currentTime * 1000
      const thumbnailImageIdx = this.thumbnailImageList.findIndex((e) => e.time === currentTime)
      if (thumbnailImageIdx !== -1) {
        this.thumbnailImageList[thumbnailImageIdx].image = canvas;
      }
    });
    this.videoForThumbnail.src = src;
    this.draw()

    while (this.isLoaded === false) {
      await this.wait(10);
    }
  }

  play () {
    const step = () => {
      this.updateThumbnail();
      this.draw();
      this.videoTimerId = requestAnimationFrame(step);
    }

    this.playButton.textContent = 'Pause';
    this.isPlaying = true;
    this.video.play();
    if (this.videoTimerId === null) {
      this.videoTimerId = requestAnimationFrame(step);
    }
  }

  pause () {
    cancelAnimationFrame(this.videoTimerId);
    this.videoTimerId = null;
    this.playButton.textContent = 'Play';
    this.isPlaying = false;
    this.video.pause();
  }

  resize() {
    this.canvas.width = this.dom.clientWidth;
    this.canvas.height = this.dom.clientHeight;
    this.updateThumbnail();
    this.draw();
  }

  draw() {
    const ctx = this.canvas.getContext('2d');

    // 背景を描画
    ctx.fillStyle = VIDEO_BACKGROUND_COLOR;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 動画が読み込まれていない場合は何もしない
    if (this.video === null) {
      return;
    }

    this.currentTimeMs = this.video.currentTime * 1000

    // 動画を描画
    const viedoWidth = this.video.videoWidth;
    const videoHeight = this.video.videoHeight;
    const videoAreaWidth = this.canvas.width;
    const videoAreaHeight = this.canvas.height - TIMELINE_HEIGHT;
    const videoAspect = viedoWidth / videoHeight;
    const videoAreaAspect = videoAreaWidth / videoAreaHeight;
    let offsetX = 0;
    let offsetY = 0;
    if (this.video.videoWidth > this.video.videoHeight) {
      if (videoAspect > videoAreaAspect) {
        offsetY = (videoAreaHeight - videoAreaWidth / videoAspect) / 2;
      } else {
        offsetX = (videoAreaWidth - videoAreaHeight * videoAspect) / 2;
      }
    } else {
      if (videoAspect > videoAreaAspect) {
        offsetY = (videoAreaHeight - videoAreaWidth / videoAspect) / 2;
      } else {
        offsetX = (videoAreaWidth - videoAreaHeight * videoAspect) / 2;
      }
    }
    ctx.drawImage(this.video, offsetX, offsetY, videoAreaWidth - offsetX * 2, videoAreaHeight - offsetY * 2);

    // タイムライン背景を描画
    ctx.fillStyle = TIMELINE_BACKGROUND_COLOR;
    ctx.fillRect(0, videoAreaHeight, this.canvas.width, TIMELINE_HEIGHT);

    // タイムラインのバーを描画
    const barPosX = 0
    const barPosY = videoAreaHeight + TIMELINE_BAR_POS_Y;
    const barWidth = this.canvas.width;
    const barHeight = TIMELINE_BAR_HEIGHT;
    ctx.fillStyle = TIMELINE_BAR_BLANK_COLOR;
    ctx.fillRect(barPosX, barPosY, barWidth, barHeight);
    const videoStartPosX = this.time2pix(0)
    const videoEndPosX = this.time2pix(this.video.duration * 1000)
    ctx.fillStyle = TIMELINE_BAR_DATA_COLOR;
    ctx.fillRect(videoStartPosX, barPosY, videoEndPosX - videoStartPosX, barHeight);

    // タイムラインのスケールを描画
    ctx.font = SCALE_TIME_STR_SIZE + 'px sans-serif';
    const { scaleInterval, textInterval } = this.adjustScale(this.timeMsPerPix)
    const leftEndTime = this.pix2time(0)
    const rightEndTime = this.pix2time(this.canvas.width)
    const firstScaleTime = Math.floor(leftEndTime / scaleInterval) * scaleInterval
    let i = 0
    while (1) {
      const scaleTime = firstScaleTime + i * scaleInterval
      if (scaleTime > rightEndTime) {
        break;
      }

      if (scaleTime > this.video.duration * 1000) {
        break;
      }

      if (scaleTime < 0) {
        i++
        continue
      }

      const scalePosX = this.time2pix(scaleTime)
      const scalePosStartY = videoAreaHeight + TIMELINE_BAR_POS_Y + TIMELINE_BAR_HEIGHT
      const scalePosEndY = scaleTime % textInterval === 0 ? 
        scalePosStartY + TIMELINE_SCALE_HEIGHT * 2 : 
        scalePosStartY + TIMELINE_SCALE_HEIGHT
      ctx.fillStyle = TIMELINE_SCALE_COLOR;
      ctx.fillRect(scalePosX, scalePosStartY, 1, scalePosEndY - scalePosStartY)

      if (scaleTime % textInterval === 0) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(this.time2str(scaleTime), scalePosX, scalePosEndY + 5)

        const thumbnailHeight = THUMBNAIL_IMAGE_HEIGHT
        const thumbnailWidth = THUMBNAIL_IMAGE_HEIGHT * viedoWidth / videoHeight
        const thumbnailPosY = videoAreaHeight + THUMBNAIL_IMAGE_MARGIN
        const thumbnailPosX = scalePosX - thumbnailWidth / 2
        ctx.fillStyle = THUMBNAIL_BACKGROUND_COLOR;
        ctx.fillRect(thumbnailPosX, thumbnailPosY, thumbnailWidth, thumbnailHeight)
        const thumbnailImageIdx = this.thumbnailImageList.findIndex((e) => e.time === scaleTime)
        if (thumbnailImageIdx !== -1) {
          const thumbnailImage = this.thumbnailImageList[thumbnailImageIdx].image
          if (thumbnailImage !== null) {
            ctx.drawImage(thumbnailImage, thumbnailPosX, thumbnailPosY)
          }
        }
      }
      i++
    }

    // 中心の線を描画
    const centerLinePosX = this.canvas.width / 2
    const centerLinePosY = videoAreaHeight
    const centerLineWidth = 1
    const centerLineHeight = TIMELINE_HEIGHT
    ctx.fillStyle = TIMELINE_CETER_LINE_COLOR;
    ctx.fillRect(centerLinePosX, centerLinePosY, centerLineWidth, centerLineHeight);
  }

  async updateThumbnail() {
    if (this.videoForThumbnail === null) {
      return;
    }

    const { scaleInterval, textInterval } = this.adjustScale(this.timeMsPerPix)
    const leftEndTime = this.pix2time(0)
    const rightEndTime = this.pix2time(this.canvas.width)
    const firstScaleTime = Math.floor(leftEndTime / scaleInterval) * scaleInterval

    let i = 0
    while (1) {
      const scaleTime = firstScaleTime + i * scaleInterval
      if (scaleTime > rightEndTime) {
        break;
      }

      if (scaleTime > this.video.duration * 1000) {
        break;
      }

      if (scaleTime < 0) {
        i++
        continue
      }

      if (scaleTime % textInterval !== 0) {
        i++
        continue      
      }

      if (this.thumbnailImageList.some((e) => e.time === scaleTime)) {
        i++
        continue
      }

      const thumbnailImage = {
        time: scaleTime,
        image: null,
      }
      this.thumbnailImageList.push(thumbnailImage)

      i++
    }

    this.loadThumbnailImage()
  }

  async loadThumbnailImage() {
    if (this.isThumbnailLoadProcessLocked) {
      // console.log('isThumbnailLoadProcessLocked')
      return
    }

    while (1) {
      this.isThumbnailLoadProcessLocked = true

      const notLoadedThumbnailImage = this.thumbnailImageList.find((e) => e.image === null)
      if (!notLoadedThumbnailImage) {
        break
      }
      const scaleTime = notLoadedThumbnailImage.time
      this.videoForThumbnail.currentTime = scaleTime / 1000

      const startTime = Date.now()
      // console.log('thumbnail load start ', scaleTime, '---------------')
      while (notLoadedThumbnailImage.image === null) {
        // console.log('  |-thumbnail load wait')
        await this.wait(10)
        const thumbnail = this.thumbnailImageList.find((e) => e.time === scaleTime)
        if (!thumbnail) {
          // console.log('  |-thumbnail not found', scaleTime)
          break
        }
        const duration = Date.now() - startTime
        if (thumbnail.image !== null) {
          // console.log('  |-thumbnail load end', duration)
          this.draw()
          break
        }
        if (duration > 5000) {
          // console.log('  |-updateThumbnail timeout', scaleTime)
          break
        } 
      }
    }

    this.isThumbnailLoadProcessLocked = false
    this.draw()
  }

  wait(timeMs) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, timeMs);
    });
  }

  time2pix(timeMs) {
    const leftEndTimeMs = this.currentTimeMs - this.canvas.width / 2 * this.timeMsPerPix;
    return (timeMs - leftEndTimeMs) / this.timeMsPerPix
  }

  pix2time(pix) {
    const leftEndTimeMs = this.currentTimeMs - this.canvas.width / 2 * this.timeMsPerPix;
    return pix * this.timeMsPerPix + leftEndTimeMs;
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