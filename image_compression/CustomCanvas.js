class CustomCanvas {
    static MAX_SIZE = 400;
    static _yuv_data = {
        y: new Uint8ClampedArray(CustomCanvas.MAX_SIZE * CustomCanvas.MAX_SIZE),
        u: new Uint8ClampedArray(CustomCanvas.MAX_SIZE * CustomCanvas.MAX_SIZE),
        v: new Uint8ClampedArray(CustomCanvas.MAX_SIZE * CustomCanvas.MAX_SIZE)
    };
    static isInverted = false;
    static skip = { y: 1, u: 2, v: 2 };
    static switches = { y: null, u: null, v: null };
    static canvas_element = null;
    static input_file_element = null;

    static init = () => {
        CustomCanvas.input_file_element = document.getElementById('input-img');
        CustomCanvas.canvas_element = document.getElementById('canvas-yuv');
        CustomCanvas.switches = {
            y: document.getElementById('chkY'),
            u: document.getElementById('chkU'),
            v: document.getElementById('chkV')
        };
        CustomCanvas.input_file_element.addEventListener('change', CustomCanvas.loadImage, false);
        CustomCanvas.switches.y.addEventListener('change', CustomCanvas.drawImage, false);
        CustomCanvas.switches.u.addEventListener('change', CustomCanvas.drawImage, false);
        CustomCanvas.switches.v.addEventListener('change', CustomCanvas.drawImage, false);
        CustomCanvas.skipYInput = document.getElementById('skipY');
        CustomCanvas.skipUInput = document.getElementById('skipU');
        CustomCanvas.skipVInput = document.getElementById('skipV');
        [CustomCanvas.skipYInput, CustomCanvas.skipUInput, CustomCanvas.skipVInput].forEach((el, i) => {
            el.addEventListener('input', () => {
                CustomCanvas.skip.y = parseInt(CustomCanvas.skipYInput.value) || 1;
                CustomCanvas.skip.u = parseInt(CustomCanvas.skipUInput.value) || 1;
                CustomCanvas.skip.v = parseInt(CustomCanvas.skipVInput.value) || 1;
                CustomCanvas.drawImage();
            });
        });
        document.getElementById('invertYUVBtn').addEventListener('click', CustomCanvas.invertY);
        CustomCanvas.canvas_element.width = CustomCanvas.MAX_SIZE;
        CustomCanvas.canvas_element.height = CustomCanvas.MAX_SIZE;
    }

    static loadImage = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const img = new Image();
        img.onload = function () {
            const img_data = CustomCanvas.getImageData(img);
            CustomCanvas.setYUVfromImg(img_data);
            CustomCanvas.drawImage();
        };
        img.src = URL.createObjectURL(file);
    }

    static getImageData = (img) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = CustomCanvas.MAX_SIZE;
        canvas.height = CustomCanvas.MAX_SIZE;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, CustomCanvas.MAX_SIZE, CustomCanvas.MAX_SIZE);
        context.drawImage(img, 0, 0, CustomCanvas.MAX_SIZE, CustomCanvas.MAX_SIZE);
        return context.getImageData(0, 0, CustomCanvas.MAX_SIZE, CustomCanvas.MAX_SIZE).data;
    }

    static setYUVfromImg = (img_data) => {
        const y = CustomCanvas._yuv_data.y;
        const u = CustomCanvas._yuv_data.u;
        const v = CustomCanvas._yuv_data.v;
        for (let i = 0; i < CustomCanvas.MAX_SIZE * CustomCanvas.MAX_SIZE; i++) {
            const r = img_data[i * 4];
            const g = img_data[i * 4 + 1];
            const b = img_data[i * 4 + 2];
            const yuv = CustomCanvas.calcRGBtoYUV({ r, g, b });
            y[i] = yuv.y;
            u[i] = yuv.u;
            v[i] = yuv.v;
        }
    }

    static calcRGBtoYUV = ({ r, g, b }) => {
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        const u = -0.169 * r - 0.331 * g + 0.5 * b + 128;
        const v = 0.5 * r - 0.419 * g - 0.081 * b + 128;
        return { y, u, v };
    }

    static calcYUVtoRGB = ({ y, u, v }) => {
        const r = y + 1.402 * (v - 128);
        const g = y - 0.344136 * (u - 128) - 0.714136 * (v - 128);
        const b = y + 1.772 * (u - 128);
        return { r: Math.max(0, Math.min(255, r)), g: Math.max(0, Math.min(255, g)), b: Math.max(0, Math.min(255, b)) };
    }

    static invertY = () => {
        const y = CustomCanvas._yuv_data.y;
        for (let i = 0; i < y.length; i++) {
            y[i] = 255 - y[i];
        }
        CustomCanvas.isInverted = !CustomCanvas.isInverted;
        const btn = document.getElementById('invertYUVBtn');
        if (CustomCanvas.isInverted) btn.classList.add('inverted');
        else btn.classList.remove('inverted');
        CustomCanvas.drawImage();
    }

    static drawImage = () => {
        const ctx = CustomCanvas.canvas_element.getContext('2d');
        const size = CustomCanvas.MAX_SIZE;
        const yArr = CustomCanvas.switches.y.checked ? CustomCanvas._yuv_data.y : new Uint8ClampedArray(size * size).fill(CustomCanvas.isInverted ? 255 : 0);
        const uArr = CustomCanvas.switches.u.checked ? CustomCanvas._yuv_data.u : new Uint8ClampedArray(size * size).fill(128);
        const vArr = CustomCanvas.switches.v.checked ? CustomCanvas._yuv_data.v : new Uint8ClampedArray(size * size).fill(128);
        const skipY = CustomCanvas.skip.y;
        const skipU = CustomCanvas.skip.u;
        const skipV = CustomCanvas.skip.v;
        const img_data = ctx.createImageData(size, size);
        for (let yIdx = 0; yIdx < size; yIdx++) {
            for (let xIdx = 0; xIdx < size; xIdx++) {
                const idx = yIdx * size + xIdx;
                const y_base = yIdx * size + Math.floor(xIdx / skipY) * skipY;
                const u_base = yIdx * size + Math.floor(xIdx / skipU) * skipU;
                const v_base = yIdx * size + Math.floor(xIdx / skipV) * skipV;
                const yVal = yArr[y_base] ?? 0;
                const uVal = uArr[u_base] ?? 128;
                const vVal = vArr[v_base] ?? 128;
                const rgb = CustomCanvas.calcYUVtoRGB({ y: yVal, u: uVal, v: vVal });
                img_data.data[idx * 4] = rgb.r;
                img_data.data[idx * 4 + 1] = rgb.g;
                img_data.data[idx * 4 + 2] = rgb.b;
                img_data.data[idx * 4 + 3] = 255;
            }
        }
        ctx.putImageData(img_data, 0, 0);
    }
}

window.addEventListener('DOMContentLoaded', CustomCanvas.init);
