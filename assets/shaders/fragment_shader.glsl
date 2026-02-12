#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uTextureLayer;
uniform sampler2D uWarpMap;

uniform float uAnimProgress;
uniform float uOpacity;

uniform vec2 uLayerOrigin;
uniform float uTargetRadius;
uniform vec2 uImageSize;

uniform uint uUseExpand;//0=false, 1=true

void main() {
    if(uUseExpand==1u){
        //dist origin
        vec2 pixelLocation = vUV*uImageSize;
        vec2 originDiff = pixelLocation-uLayerOrigin;
        float originDist = sqrt(
            (originDiff.x*originDiff.x)+
            (originDiff.y*originDiff.y)
        );

        vec4 warpMapColor = texture(uWarpMap,vUV);

        float spreadRadius = uAnimProgress*(warpMapColor.r+1.0);
        if ((originDist/uTargetRadius) > spreadRadius) discard;

        vec4 textureColor = texture(uTextureLayer,vUV);
        fragColor = textureColor;
    }else if(uUseExpand==0u){
        //if this isnt an expanding thing just sample the texture
        vec4 textureColor = texture(uTextureLayer,vUV);
        fragColor = textureColor;
    }else if(uUseExpand==2u){
        vec4 textureColor = texture(uTextureLayer,vUV);
        vec4 textureColor2 = texture(uWarpMap,vUV);
        fragColor = mix(textureColor,textureColor2,uAnimProgress);  
    }else if(uUseExpand==3u){
        
        vec4 textureColor = texture(uTextureLayer,vUV);
        vec4 white = vec4(1.0,1.0,1.0,1.0);
        fragColor = mix(white,textureColor,uAnimProgress);  
    }
    fragColor.a*=uOpacity;
    fragColor.rgb*=fragColor.a;
}