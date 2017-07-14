var gulp = require('gulp'),
    browserify = require('browserify'),
    source = require('vinyl-source-stream'),
    uglify = require('gulp-uglify'),
    streamify = require('gulp-streamify'),
    watchify = require('watchify');


gulp.task('compile_dev', function () {
    // place code for your default task here
    var b = browserify({
        entries: ['./src/main.js'],
        plugin: [watchify]
    }).transform('browserify-css', {global: true});

    function bundle() {
        return b.bundle()
            .pipe(source('bundle.js'))
            .pipe(gulp.dest('./build/'));
    }

    b.on('update', bundle);

    return bundle();
});


gulp.task('compile_prod', function () {
    // place code for your default task here
    return browserify('./src/main.js')
        .transform('browserify-css', {global: true})
        .bundle()
        .pipe(source('bundle.js'))
        .pipe(streamify(uglify()))
        .pipe(gulp.dest('./build/'));
});