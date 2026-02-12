 
    const layerFolder = "assets/testimage";

    const glCanvas = document.getElementById("preview-canvas");
    /**@type {WebGL2RenderingContext} */
    const gl = glCanvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL2 not supported");//add fallback later

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            throw new Error(gl.getShaderInfoLog(shader));
        return shader;
    }

    function createProgram(gl, vsSrc, fsSrc) {
        const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
        const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
            throw new Error(gl.getProgramInfoLog(prog));
        return prog;
    }

    //CREATE THE QUAD HERE
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            -1,-1,  1,-1, -1, 1,
             1,-1,  1, 1, -1, 1
        ]),
        gl.STATIC_DRAW
    );

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }
    /**@param {WebGL2RenderingContext} gl */
    async function loadTexture(gl, url) {
        const img = await loadImage(url);

        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            img
        );

        return tex;
    }

    const loadedImageData = {
        colors:[],
        greyscales:[]
    };
    let drawFrame = () => {};//until logic is assigned to it
    //stores the animation state
    const animationState = {
        progress:0,
        animationQueue:[],//keeps track of the animations it needs to transition to
        fromAnimation:"sketch",//sketch is the default even tho i hate having constants set like this
        drawing:false
    }
    //read the json data from the folder
    //eventually account for the fact this takes time
    fetch(layerFolder+"/layerData.json").then(
        async (response)=>{
            const jsonText = await response.text();
            const jsonObject = JSON.parse(jsonText);
            glCanvas.width = jsonObject.imageWidth;
            glCanvas.height = jsonObject.imageHeight;
            const loadImagePartsToList = async (fromList,toList)=>{    
            for(const v of fromList){
                    const imgPath = layerFolder+"/"+v.path.replaceAll(`\\`,"/");
                    const img = await loadTexture(gl,imgPath);
                    const obj = {};
                    obj.imageData = img;
                    obj.jsonData = v;

                    toList.push(obj); 
                }
            };
            await loadImagePartsToList(jsonObject.colors,loadedImageData.colors);
            await loadImagePartsToList(jsonObject.greyscales,loadedImageData.greyscales);

            loadedImageData.outlines={};
            loadedImageData.shading={};
            loadedImageData.highlights={};
            

            loadedImageData.outlines.colored = await loadTexture(gl,layerFolder+"/outlines/outlines-colored.png");
            loadedImageData.outlines.uncolored = await loadTexture(gl,layerFolder+"/outlines/outlines-uncolored.png");
            loadedImageData.outlines.sketch = await loadTexture(gl,layerFolder+"/outlines/outlines-sketch.png");
            
            loadedImageData.shading.colored = await loadTexture(gl,layerFolder+"/shading/shading-colored.png");
            loadedImageData.shading.uncolored = await loadTexture(gl,layerFolder+"/shading/shading-uncolored.png");
            
            loadedImageData.highlights.colored = await loadTexture(gl,layerFolder+"/highlights/highlights-colored.png");
            loadedImageData.warpMap = await loadTexture(gl,layerFolder+"/warp-map.png");
        }
    ).then(async ()=>{
        function randomizeColorOrigins(){
            const randomizeOriginsOfList = (list) => {
                for(const v of list){
                    v.originX = v.jsonData.x+(Math.random()*v.jsonData.width);
                    v.originY = v.jsonData.y+(Math.random()*v.jsonData.height);

                    //now calculated the distance to the farthest corner
                    const diffRight = v.originX-v.jsonData.x;
                    const diffTop = v.originY-v.jsonData.y;
                    const diffLeft = v.originX-(v.jsonData.x+v.jsonData.width);
                    const diffBottom = v.originY-(v.jsonData.y+v.jsonData.height);

                    const dist0sqrd = (diffRight**2)+(diffTop**2);
                    const dist1sqrd = (diffRight**2)+(diffBottom**2);
                    const dist2sqrd = (diffLeft**2)+(diffBottom**2);
                    const dist3sqrd = (diffLeft**2)+(diffTop**2);

                    v.targetGrowthRad = Math.sqrt(Math.max(dist0sqrd,dist1sqrd,dist2sqrd,dist3sqrd));
                }
            }
            
            randomizeOriginsOfList(loadedImageData.colors);
            randomizeOriginsOfList(loadedImageData.greyscales);
            
        }
        randomizeColorOrigins();//initialize

        const vsSource = await (await fetch("assets/shaders/vertex_shader.glsl")).text();
        const fsSource = await (await fetch("assets/shaders/fragment_shader.glsl")).text();

        const program = createProgram(gl,vsSource,fsSource);
        //bind the texture
        const attribs = {
            vertexPos: gl.getAttribLocation(program,"aPos"),
        };

        const uniforms = {
            textureLayer: gl.getUniformLocation(program,"uTextureLayer"),
            warpMap: gl.getUniformLocation(program,"uWarpMap"),
            animProgress: gl.getUniformLocation(program,"uAnimProgress"),
            layerOrigin: gl.getUniformLocation(program,"uLayerOrigin"),
            targetRad: gl.getUniformLocation(program,"uTargetRadius"),
            imageSize: gl.getUniformLocation(program,"uImageSize"),
            useExpand: gl.getUniformLocation(program,"uUseExpand"),
            opacity: gl.getUniformLocation(program,"uOpacity")
        }

        let lastDrawTime=0;
        //assign this function
        drawFrame = () => {
            if(!animationState.drawing) lastDrawTime=performance.now();

            animationState.drawing=true;

            if((animationState.progress>=1.0)&&(animationState.animationQueue.length>0)){
                animationState.progress=0.0;
            }

            //make animation progress framerate independant
            const timeBetweenDraws = performance.now()-lastDrawTime;
            const progressIncrement = timeBetweenDraws*0.00275;
            animationState.progress = Math.min(animationState.progress + progressIncrement, 1);
            lastDrawTime=performance.now();

            const animFrom = animationState.fromAnimation;
            const animTo = animationState.animationQueue.length>0 ? animationState.animationQueue[0] : animFrom;
            
            const bg_sketch = {
                r:0.70980392156,
                g:0.70980392156,
                b:0.70980392156
            };
            const bg_colored = {
                r:1.0,
                g:1.0,
                b:1.0
            };
            const bg_black_white = bg_colored;//these are the same for now

            //functions to help with drawing
            const lerp = (a,b,i) => a+((b-a)*i);
            const lerpColors = (a,b,i) => {return {
                r:lerp(a.r,b.r,i),
                g:lerp(a.g,b.g,i),
                b:lerp(a.b,b.b,i)
            }};
            const loadTex0 = (gl,image) => {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, image);
                gl.uniform1i(uniforms.textureLayer,0);
            };
            const loadTex1 = (gl,image) => {
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, image);
                gl.uniform1i(uniforms.warpMap, 1);
            };
            const drawTex0Image = (gl,image) => {
                loadTex0(gl,image);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            };
            //should only be called if the mode is already set to transition
            const drawInterpolatedImage = (gl, imageA, imageB) => {
                loadTex0(gl,imageA);
                loadTex1(gl,imageB);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            };
            const blendModeNormal = (gl) => {gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);/*i dont know why these are premultiplied apparently its a thing with clip studio*/};
            const blendModeMultiply = (gl) => {gl.blendFunc(gl.ZERO,gl.SRC_COLOR);};
            const blendModeAdd = (gl) => {gl.blendFunc(gl.ONE,gl.ONE);};
            const backgroundColor = (gl,color) => {
                gl.clearColor(color.r,color.g,color.b,1.0);
                gl.clear(gl.COLOR_BUFFER_BIT);
            };
            const interpolateBackground = (gl,colorA,colorB,i) => {
                const bgColor = lerpColors(colorA,colorB,i);
                backgroundColor(gl,bgColor);
            };
            const modeDefault = (gl) => {gl.uniform1ui(uniforms.useExpand,0);};
            const modeExpand = (gl) => {gl.uniform1ui(uniforms.useExpand,1);};
            const modeTransition = (gl) => {gl.uniform1ui(uniforms.useExpand,2);};
            const modeFadeWhite = (gl) => {gl.uniform1ui(uniforms.useExpand,3);};
            
            const setOpacity = (gl,v) => {gl.uniform1f(uniforms.opacity,v);};
            //specific functions
            const fadeHighlights = (gl,i) => {
                modeDefault(gl);
                blendModeAdd(gl);
                setOpacity(gl,i);
                drawTex0Image(gl,imgData.highlights.colored);
            };
            /*VALUES THAT ARE THE SAME FOR EVERY ANIMATION*/
            gl.useProgram(program);

            //viewport is the same no matter what
            gl.viewport(0, 0, glCanvas.width, glCanvas.height);
            gl.uniform2f(uniforms.imageSize,glCanvas.width,glCanvas.height);
            gl.enable(gl.BLEND);
            
            //theres only one mesh ever
            gl.enableVertexAttribArray(attribs.vertexPos);
            gl.bindBuffer(gl.ARRAY_BUFFER, quad);
            gl.vertexAttribPointer(attribs.vertexPos, 2, gl.FLOAT, false, 0, 0);
            //warp map is always the same
            loadTex1(gl,loadedImageData.warpMap);
            //opacity initially set to 1
            setOpacity(gl,1.0);
            
            const imgData = loadedImageData;//shorthand refrence

            if(
                animFrom=="sketch"&&
                animTo=="fully-shaded"
            ){
                gl.uniform1f(uniforms.animProgress,animationState.progress);

                interpolateBackground(gl,bg_sketch,bg_colored,animationState.progress);

                blendModeNormal(gl);

                modeExpand(gl);
                for(const v of loadedImageData.colors){

                    gl.uniform2f(uniforms.layerOrigin,v.originX,v.originY);
                    gl.uniform1f(uniforms.targetRad,v.targetGrowthRad);

                    drawTex0Image(gl,v.imageData);
                }
                
                modeTransition(gl);
                drawInterpolatedImage(gl,imgData.outlines.sketch,imgData.outlines.colored);
                
                modeFadeWhite(gl);
                blendModeMultiply(gl);
                drawTex0Image(gl,imgData.shading.colored);

                //fade in highlights
                fadeHighlights(gl,animationState.progress);
                
            }else if(
                animFrom=="fully-shaded"&&
                animTo=="sketch"
            ){
                gl.uniform1f(uniforms.animProgress,1.0-animationState.progress);

                interpolateBackground(gl,bg_colored,bg_sketch,animationState.progress);
                
                blendModeNormal(gl);

                modeExpand(gl);
                for(const v of imgData.colors){

                    gl.uniform2f(uniforms.layerOrigin,0,0);
                    gl.uniform1f(uniforms.targetRad,Math.sqrt((glCanvas.height*glCanvas.height)+(glCanvas.width*glCanvas.width)));

                    drawTex0Image(gl,v.imageData);
                }
                
                modeTransition(gl);
                drawInterpolatedImage(gl,imgData.outlines.sketch,imgData.outlines.colored);
                
                modeFadeWhite(gl);
                blendModeMultiply(gl);
                drawTex0Image(gl,imgData.shading.colored);
                
                //fade highlights out
                fadeHighlights(gl,1.0-animationState.progress);
            }else if(
                animFrom=="fully-shaded"&&
                animTo=="black-and-white"
            ){
                gl.uniform1f(uniforms.animProgress,animationState.progress);

                interpolateBackground(gl,bg_colored,bg_black_white,animationState.progress);
                
                blendModeNormal(gl);
                modeDefault(gl);
                
                //draw the underlying greyscales
                for(const v of imgData.greyscales){
                    drawTex0Image(gl,v.imageData);
                }

                //fade out the colors
                setOpacity(gl,1.0-animationState.progress);
                for(const v of imgData.colors){
                    drawTex0Image(gl,v.imageData);
                }

                //return opacity back to how it was
                setOpacity(gl,1.0);
                modeTransition(gl);
                drawInterpolatedImage(gl,imgData.outlines.colored,imgData.outlines.uncolored);
                
                //shading
                blendModeMultiply(gl);

                drawInterpolatedImage(gl,imgData.shading.colored,imgData.shading.uncolored);
                
                //fade highlights out
                fadeHighlights(gl,1.0-animationState.progress);
            }else if(
                animFrom=="black-and-white"&&
                animTo=="fully-shaded"
            ){
                gl.uniform1f(uniforms.animProgress,animationState.progress);

                interpolateBackground(gl,bg_black_white,bg_colored,animationState.progress);
                
                blendModeNormal(gl);
                modeDefault(gl);

                //draw the underlying greyscales
                for(const v of imgData.greyscales){
                    drawTex0Image(gl,v.imageData);
                }
                //fade in the colors
                setOpacity(gl,animationState.progress);
                for(const v of imgData.colors){
                    drawTex0Image(gl,v.imageData);
                }

                //return opacity back to how it was
                setOpacity(gl,1.0);
                modeTransition(gl);
                drawInterpolatedImage(gl,imgData.outlines.uncolored,imgData.outlines.colored);
                
                //shading
                blendModeMultiply(gl);
                drawInterpolatedImage(gl,imgData.shading.uncolored,imgData.shading.colored);

                //fade in highlights
                fadeHighlights(gl,animationState.progress);
            }else if(
                animFrom=="sketch"&&
                animTo=="black-and-white"
            ){
                gl.uniform1f(uniforms.animProgress,animationState.progress);

                interpolateBackground(gl,bg_sketch,bg_black_white,animationState.progress);
                
                blendModeNormal(gl);

                modeExpand(gl);
                for(const v of loadedImageData.greyscales){

                    gl.uniform2f(uniforms.layerOrigin,v.originX,v.originY);
                    gl.uniform1f(uniforms.targetRad,v.targetGrowthRad);

                    drawTex0Image(gl,v.imageData);
                }
                
                modeTransition(gl);
                drawInterpolatedImage(gl,imgData.outlines.sketch,imgData.outlines.uncolored);
                
                modeFadeWhite(gl);
                blendModeMultiply(gl);
                drawTex0Image(gl,imgData.shading.uncolored);
            }else if(
                animFrom=="black-and-white"&&
                animTo=="sketch"
            ){
                //progress backwards for this one...
                gl.uniform1f(uniforms.animProgress,1.0-animationState.progress);

                interpolateBackground(gl,bg_black_white,bg_sketch,animationState.progress);
                
                blendModeNormal(gl);

                modeExpand(gl);
                for(const v of loadedImageData.greyscales){

                    gl.uniform2f(uniforms.layerOrigin,0,0);
                    gl.uniform1f(uniforms.targetRad,Math.sqrt((glCanvas.height*glCanvas.height)+(glCanvas.width*glCanvas.width)));

                    drawTex0Image(gl,v.imageData);
                }
                
                modeTransition(gl);
                drawInterpolatedImage(gl,imgData.outlines.sketch,imgData.outlines.uncolored);
                
                modeFadeWhite(gl);
                blendModeMultiply(gl);
                drawTex0Image(gl,imgData.shading.uncolored);

            }else if(
                animFrom=="sketch"&&
                animTo=="sketch"
            ){
                backgroundColor(gl,bg_sketch);
                
                blendModeNormal(gl);
                modeDefault(gl);

                drawTex0Image(gl,imgData.outlines.sketch);
            }


            if(animationState.progress>=1.0&&(animationState.animationQueue.length>0)){
                animationState.fromAnimation=animationState.animationQueue.shift();
                randomizeColorOrigins();//this is only used for a few transitions right now but
            }

            if((animationState.progress>=1.0)&&(animationState.animationQueue.length==0)){ 
                animationState.drawing=false;
                return;//stop animating if theres nothing left
            }
            
            requestAnimationFrame(drawFrame);
        }
        drawFrame();
    });

//to make sure the queue doesnt get super long remove everything ecxept the first and last element
function limitQueueSize(){
    const queue = animationState.animationQueue;//shorthand refrence
    queue.splice(1,queue.length-2);
}
limitQueueSize();

/**@param {string} styleName */
function beginStyleTransitionTo(styleName){

    animationState.animationQueue.push(styleName);//push to the back of the queu
    
    limitQueueSize();//this might be optional later but, i could also just try preventing the queue from even needing this by popping the last element if needed BEFORE adding new elements
    
    if(!animationState.drawing) drawFrame();
}
