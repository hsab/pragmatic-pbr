//Based on Article - Physically Based Rendering by Marco Alamia
//http://www.codinglabs.net/article_physically_based_rendering.aspx

#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: random    = require(glsl-random)
#pragma glslify: envMapCube      = require(../../glsl-envmap-cube)

varying vec3 wcNormal;
varying vec2 scPosition;

uniform samplerCube uEnvMap;
uniform sampler2D uHammersleyPointSetMap;
uniform float uRoughness;
uniform int uNumSamples;

const float PI = 3.1415926536;

float saturate(float f) {
    return clamp(f, 0.0, 1.0);
}

vec3 saturate(vec3 v) {
    return clamp(v, vec3(0.0), vec3(1.0));
}

//Sampled from a texture generated by code based on
//http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
vec2 Hammersley(int i, int N) {
    return texture2D(uHammersleyPointSetMap, vec2(0.5, (float(i) + 0.5)/float(N))).rg;
}

//Based on Real Shading in Unreal Engine 4
vec3 ImportanceSampleGGX(vec2 Xi, float Roughness, vec3 N) {
    //this is mapping 2d point to a hemisphere but additionally we add spread by roughness
    float a = Roughness * Roughness;
    float Phi = 2.0 * PI * Xi.x + random(N.xz) * 0.1;
    float CosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float SinTheta = sqrt(1.0 - CosTheta * CosTheta);
    vec3 H;
    H.x = SinTheta * cos(Phi);
    H.y = SinTheta * sin(Phi);
    H.z = CosTheta;

    //Tangent space vectors
    vec3 UpVector = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 TangentX = normalize(cross(UpVector, N));
    vec3 TangentY = normalize(cross(N, TangentX));

    //Tangent to World Space
    return TangentX * H.x + TangentY * H.y + N * H.z;

    //
    //vec3 n = N;
    //float aa = 1.0 / (1.0 + n.z);
    //float b = -n.x * n.y * aa;
    //vec3 b1 = vec3(1.0 - n.x * n.x * aa, b, -n.x);
    //vec3 b2 = vec3(b, 1.0 - n.y * n.y * aa, -n.y);
    //mat3 vecSpace = mat3(b1, b2, n);
    //return normalize(mix(vecSpace * H, N, 1.0 - Roughness));
}

vec3 PrefilterEnvMap( float Roughness, vec3 R ) {
    vec3 N = R;
    vec3 V = R;
    vec3 PrefilteredColor = vec3(0.0);
    const int NumSamples = 1024;//1024
    float TotalWeight = 0.0;
    for( int i = 0; i < NumSamples; i++ ) {
        vec2 Xi = Hammersley( i, NumSamples );
        vec3 H = ImportanceSampleGGX( Xi, Roughness, N );
        vec3 L = 2.0 * dot( V, H ) * H - V;
        float NoL = saturate( dot( N, L ) );
        if( NoL > 0.0 ) {
            PrefilteredColor += textureCube( uEnvMap, L).rgb * NoL;
            TotalWeight += NoL;
        }
    }
    return PrefilteredColor / TotalWeight;
}

void main() {
    vec3 normal = normalize( wcNormal );

    gl_FragColor.rgb = PrefilterEnvMap(uRoughness, normal);
    gl_FragColor.a = 1.0;
}
