// ray tracing constants
const float EPSILON = 0.001; // how close is close enough
const float RAY_EXTENT = 10.; // how far the ray can travel
const int MAX_STEPS = 100; // max ray marching steps
const float DELTA = 0.001; // finite difference step for surface normal

mat3 getRayTransform( in vec3 camera_pos, in vec3 focus_point, in float roll) {
    vec3 ww = normalize( focus_point - camera_pos ); // unit vec from camera to focus
    vec3 rr = vec3(sin(roll),cos(roll),0.0); // rotation vec on unit circle
    vec3 uu = normalize(cross(ww, rr)); // "right"
    vec3 vv = normalize(cross(uu, ww)); // "up"
    return mat3(uu, vv, ww); // transform ray
}

vec2 sdfSphere(in vec3 ray_pos) {
    float obj_id = 1.;
    
    vec3 pos = vec3(0., 0., -.4);
    float radius = .9;
    
    float dist = length(ray_pos - pos);
    float dist_to_surf = dist - radius;
    
    return vec2(dist_to_surf, obj_id);
}

vec2 sdfMoon(in vec3 ray_pos) {
    float obj_id = 2.;
    vec3 planet_pos = vec3(0., 0., -.4);

    // orbit controls
    vec3 orbit_axis = normalize(vec3(-0.5, 1.0, 1.0)); // set this to pick the orbit plane (axis ⟂ plane)
    float orbit_radius = 1.8;                          // distance from planet to moon
    float orbit_speed  = 0.8;                          // radians per second
    float th = orbit_speed * iTime;                    // angle rn

    // pick a stable perpendicular seed vector to the axis
    vec3 seed = (abs(orbit_axis.y) < 0.999) ? vec3(0.,1.,0.) : vec3(1.,0.,0.);
    vec3 v0 = normalize(cross(orbit_axis, seed)) * orbit_radius;

    // rodrigues rotate v0 around orbit_axis by th
    float c = cos(th), s = sin(th), ic = 1.0 - c;
    vec3 orbit_vec = v0 * c + cross(orbit_axis, v0) * s + orbit_axis * dot(orbit_axis, v0) * ic;

    vec3 moon_pos = planet_pos + orbit_vec;
    float moon_radius = .2;

    float dist = length(ray_pos - moon_pos);
    float dist_to_surf = dist - moon_radius;

    return vec2(dist_to_surf, obj_id);
}

vec2 sdfCube(in vec3 ray_pos) {
    float obj_id = 2.;
    
    vec3 pos  = vec3(-.8, -.4, 0.2);
    vec3 size = vec3(.4, .3, .2);

    const float OMEGA = 1.0;
    vec3 axis = normalize(vec3(0.0, -1.0, 1.0));
    float th = OMEGA * iTime;

    // rodrigues rotation matrix R(axis, th)
    float c = cos(th), s = sin(th), ic = 1.0 - c;
    vec3 a = axis;
    mat3 R = mat3(
        c + a.x*a.x*ic,      a.x*a.y*ic - a.z*s, a.x*a.z*ic + a.y*s,
        a.y*a.x*ic + a.z*s,  c + a.y*a.y*ic,     a.y*a.z*ic - a.x*s,
        a.z*a.x*ic - a.y*s,  a.z*a.y*ic + a.x*s, c + a.z*a.z*ic
    );
    vec3 p = transpose(R) * (ray_pos - pos);

    // axis-aligned box sdf in local frame
    vec3 d = abs(p) - size;
    float max_coord = max(d.x, max(d.y, d.z));
    float dist_to_surf = min(max_coord, 0.0) + length(max(d, 0.0));
    
    return vec2(dist_to_surf, obj_id);
}

vec2 getClosest(vec2 current, vec2 next) {
    return (next.x < current.x) ? next : current;
}

vec2 sceneSDF(in vec3 ray_pos) {
    vec2 d = vec2(1e9, -1.);
    d = getClosest(d, sdfSphere(ray_pos));
    d = getClosest(d, sdfMoon(ray_pos));
    
    return d;
}

vec2 rayMarch(in vec3 camera_pos, in vec3 ray_dir) {
    // march ray and see if it his something in scene
    float dist_to_surface = EPSILON * 2.0; // must start bigger than epsilon
    float dist_travelled = 0.; // ray travel distance
    
    float final_distance = -1.;
    float final_obj_id = -1.;

    for(int step_idx = 0; step_idx < MAX_STEPS; step_idx++ ){
    
        // if we intersected an object or went too far, stop iterating
        if( dist_to_surface < EPSILON ) break;
        if( dist_travelled > RAY_EXTENT ) break;
        
        vec3 ray_position = camera_pos + ray_dir * dist_travelled;
        
        // get information of closest object
        vec2 sdf_id = sceneSDF(ray_position);
        float obj_sdf = sdf_id.x;
        float obj_id = sdf_id.y;
        dist_to_surface = obj_sdf;
        final_obj_id = obj_id;
        
        // if closest object is in the ray line, we can jump straight to surface
        // if not, then it's safe to jump by this amount forward and check again for closest object
        dist_travelled += dist_to_surface;
    }
    
    if(dist_travelled < RAY_EXTENT) {
        final_distance = dist_travelled;
    }
    if(dist_travelled >= RAY_EXTENT) { 
        final_distance = RAY_EXTENT;
        final_obj_id = -1.; // obj ID is always closest object, so reset if we never intersected
    }
    return vec2(final_distance, final_obj_id);
}

vec3 getSurfaceNormal(in vec3 position) {

	vec3 dx = vec3(DELTA, 0.0, 0.0);
    vec3 dy = vec3(0.0, DELTA, 0.0);
    vec3 dz = vec3(0.0, 0.0, DELTA);
    
    float dfdx1 = sceneSDF(position + dx).x;
    float dfdx2 = sceneSDF(position - dx).x;
    float dfdx = dfdx1 - dfdx2;
    
    float dfdy1 = sceneSDF(position + dy).x;
    float dfdy2 = sceneSDF(position - dy).x;
    float dfdy = dfdy1 - dfdy2;

    float dfdz1 = sceneSDF(position + dz).x;
    float dfdz2 = sceneSDF(position - dz).x;
    float dfdz = dfdz1 - dfdz2;

    vec3 normal = vec3(dfdx, dfdy, dfdz);
    return normalize(normal);
}

vec3 getShadedColour(in vec3 surf_pos, in vec3 surf_norm, in vec3 colour) {
    vec3 light_pos = vec3(1., 4., 3.) / 3.0;
    vec3 light_dir = normalize(light_pos - surf_pos);
    
    float light_alignment = dot(light_dir, surf_norm);
    light_alignment = max(0., light_alignment);
    
    colour *= light_alignment; // linear scale to black
    colour += vec3( .3 , .1, .2 ); // ambient
	return colour;
}

vec3 getSceneColour(in vec2 ray_info, in vec3 camera_pos, in vec3 ray_dir) {
    // get ray hit info and decide how to colour it
    vec3 colour;
    if(ray_info.y < 0.0){
        // backgrond is black
        colour = vec3(0.188, 0.149, 0.251);
    }
    else {
        // hit!
        vec3 surf_pos = camera_pos + ray_info.x * ray_dir;
        vec3 surf_normal = getSurfaceNormal(surf_pos);
        
      if(ray_info.y == 1.0) {
        // planet
        vec3 planet_colour = vec3( 0.275 , 0.588 , 0.808);
  		colour = getShadedColour(surf_pos, surf_normal, planet_colour); 
      } else if( ray_info.y == 2.0 ) {
      	// moon
        vec3 moon_colour = vec3( 0.624 , 0.353 , 0.153); //159.90.39
  		colour = getShadedColour(surf_pos, surf_normal, moon_colour); 
      }
   }
   return colour;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // normalized pixel coordinates
    //vec2 screen = fragCoord/iResolution.xy; // from 0 to 1 in both directions
    vec2 screen = ( -iResolution.xy + 2.0 * fragCoord.xy ) / iResolution.y; // from -1 to 1 in y-dir
    
    // setup camera and rays
    vec3 camera_pos = vec3( 0., 0., 4.); // camera (eye) position
    vec3 focus_point = vec3( 0. , 0. , 0. ); // camera points towards this
    mat3 ray_transform = getRayTransform(camera_pos, focus_point, 0.);
    float focal_length = 2.0;
    vec3 ray = normalize( ray_transform * vec3( screen.xy , focal_length));
    
    // ray trace
    vec2 ray_info = rayMarch(camera_pos, ray);
    vec3 colour = getSceneColour(ray_info, camera_pos, ray);
    fragColor = vec4(colour, 1.0);

}