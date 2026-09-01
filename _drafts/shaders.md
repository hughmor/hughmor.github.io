---
date: 2025-11-09
layout: default
title: "shaders, raymarching, and signed distance functions"
description: "my progress learning to use GLSL"
---

After diving into the architecture of GPUs for a project benchmarking the latency of NVIDIA's hardware (post on this to come soon), I got interested in stepping back to the primary use-case of GPUs before the machine learning era.
I've always been fascinated with interesting visualizations of fractals and other examples of code art and mathematically driven rendering techniques, and I've dipped my toe in some of these waters before but never really made a concerted effort to teach myself how they work.

This weekend, I've been playing around with [ShaderToy](https://www.shadertoy.com) and finally made a bit of effort to learn to use shaders written in GLSL to render scenes. I started out with an effort to learn about two topics: signed distance functions (SDFs, also called signed distance fields), a way of implicitly defining objects in a seen via the mathematical functions describing their boundary, and ray marching, a technique for calculating how to display the objects described by SDFs. I had the most success after finding the blog by [Inigo Quilez](https://iquilezles.org), one of the creators of ShaderToy, who seems to be the GOAT of this type of rendering with shaders.

To start with, I'm going to present the material a bit out of order, and start with the last piece of information I learned after playing around on ShaderToy, which is how to actually embed shaders into a webpage, so that I can visualize the shaders I create as I go.


<div>
    <canvas id="myCanvas" width="500" height="500" style="width:500px;height:500px;"></canvas>

    <script id="vertexShader" type="x-shader/x-vert ex">
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    </script>

    <script id="fragmentShader" type="x-shader/x-fragment">
        precision mediump float;
        uniform vec2 u_resolution;
        uniform float u_time;
        void main() {
            // Simple gradient demo — replace with your own shader code.
            vec2 uv = gl_FragCoord.xy / u_resolution;
            vec3 col = 0.5 + 0.5 * cos(u_time + uv.xyx + vec3(0.0,2.0,4.0));
            gl_FragColor = vec4(col, 1.0);
        }
    </script>

    <script>
        const canvas = document.getElementById('myCanvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
            console.error('WebGL not supported in this browser.');
        }

        function compileShader(gl, type, source) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('Shader compile error:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        function createProgram(gl, vsSource, fsSource) {
            const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
            const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
            if (!vs || !fs) return null;
            const program = gl.createProgram();
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error('Program link error:', gl.getProgramInfoLog(program));
                gl.deleteProgram(program);
                return null;
            }
            return program;
        }

        const vsSource = document.getElementById('vertexShader').textContent;
        const fsSource = document.getElementById('fragmentShader').textContent;
        const program = createProgram(gl, vsSource, fsSource);

        const posLoc = gl.getAttribLocation(program, 'a_position');
        const resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
        const timeLoc = gl.getUniformLocation(program, 'u_time');

        // Full-screen quad (two triangles)
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1,
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        function resizeCanvasToDisplaySize(canvas) {
            const dpr = window.devicePixelRatio || 1;
            const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
            const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                return true;
            }
            return false;
        }

        function render(time) {
            time *= 0.001; // convert to seconds
            resizeCanvasToDisplaySize(canvas);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.useProgram(program);

            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

            gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
            gl.uniform1f(timeLoc, time);

            gl.drawArrays(gl.TRIANGLES, 0, 6);

            requestAnimationFrame(render);
        }

        requestAnimationFrame(render);
    </script>
</div>