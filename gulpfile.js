'use strict';
var gulp = require('gulp');
var gutil = require('gulp-util');
var minimist = require('minimist');
var _ = require('lodash');
var sourcemaps = require('gulp-sourcemaps');

var pkg = require('./package.json');
var paths = pkg.paths;
var opts = minimist(process.argv.slice(2));

require('babel-core/register');

var gif = require('gulp-if');
var merge = require('merge-stream');
var sass = require('gulp-sass');
var prefix = require('gulp-autoprefixer');

gulp.task('css', function () {
	var streams = merge();
	paths.css.forEach(function (path) {
		streams.add(gulp.src(path.src + '*.scss')
			.pipe(sourcemaps.init())
			.pipe(sass())
			.pipe(prefix({cascade: true}))
			.pipe(sourcemaps.write('./'))
			.pipe(gulp.dest(path.dest)));
	});
	return streams;
});

var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var source = require('vinyl-source-stream');
var watchify = require('watchify');
var xtend = require('xtend');

var watching = false;
gulp.task('enable-watch-mode', function () {watching = true;});

gulp.task('js', function () {
	var opts = {
		entries: './' + paths.js.src + 'app.js', // browserify requires relative path
		paths: [__dirname + '/node_modules', __dirname + '/app_joseph/cartridge/'], //add search path's
		debug: gutil.env.sourcemaps
	};
	if (watching) {
		opts = xtend(opts, watchify.args);
	}
	var bundler = browserify(opts);
	if (watching) {
		bundler = watchify(bundler);
	}
	// optionally transform
	// bundler.transform('transformer');

	bundler.on('update', function (ids) {
		gutil.log('File(s) changed: ' + gutil.colors.cyan(ids));
		gutil.log('Rebundling...');
		rebundle();
	});

	bundler.on('log', gutil.log);

	function rebundle () {
		return bundler.bundle()
			.on('error', function (e) {
				gutil.log('Browserify Error', gutil.colors.red(e));
			})
			.pipe(source('app.js'))
			// sourcemaps
				.pipe(buffer())
				.pipe(sourcemaps.init({loadMaps: true}))
				.pipe(sourcemaps.write('./'))
			//
			.pipe(gulp.dest(paths.js.dest));
	}
	return rebundle();
});

var jscs = require('gulp-jscs');

gulp.task('jscs', function () {
	return gulp.src('**/*.js')
		.pipe(jscs());
});

var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');

gulp.task('jshint', function () {
	return gulp.src('**/*.js')
		.pipe(jshint())
		.pipe(jshint.reporter(stylish));
});

var webdriver = require('gulp-webdriver');
gulp.task('test:application', function () {
	return gulp.src('test/application/webdriver/wdio.conf.js')
		.pipe(webdriver(_.omit(opts, '_')));
});

var gulpMocha = require('gulp-mocha');
gulp.task('test:unit', function () {
	var reporter = opts.reporter || 'spec';
	var timeout = opts.timeout || 10000;
	var suite = opts.suite || '*';
	return gulp.src(['test/unit/' + suite + '/**/*.js'], {read: false})
		.pipe(gulpMocha({
			reporter: reporter,
			timeout: timeout
		}));
});

gulp.task('build', ['js', 'css']);
gulp.task('lint', ['jshint', 'jscs']);

gulp.task('cssserv', function() {
	return connect.server({
		root: './app_joseph/cartridge/static/default/css',
		port: 8080
	});
});

gulp.task('default', ['enable-watch-mode', 'js', 'css', 'cssserv'], function () {
	gulp.watch(paths.css.map(function (path) {
		return path.src + '**/*.scss';
	}), ['css']);
});

var hbsfy = require('hbsfy');
var styleguideWatching = false;
gulp.task('styleguide-watching', function () {styleguideWatching = true;});
gulp.task('js:styleguide', function () {
	var opts = {
		entries: ['./styleguide/js/main.js'],
		debug: (gutil.env.sourcemaps)
	};
	if (styleguideWatching) {
		opts = xtend(opts, watchify.args);
	}
	var bundler = browserify(opts);
	if (styleguideWatching) {
		bundler = watchify(bundler);
	}

	// transforms
	bundler.transform(hbsfy);

	bundler.on('update', function (ids) {
		gutil.log('File(s) changed: ' + gutil.colors.cyan(ids));
		gutil.log('Rebundling...');
		bundle();
	});

	var bundle = function () {
		return bundler
			.bundle()
			.on('error', function (e) {
				gutil.log('Browserify Error', gutil.colors.red(e));
			})
			.pipe(source('main.js'))
			.pipe(gulp.dest('./styleguide/dist'));
	};
	return bundle();
});

var connect = require('gulp-connect');

gulp.task('connect:styleguide', function () {
	var port = opts.port || 8000;
	return connect.server({
		root: 'styleguide',
		port: port
	});
});

gulp.task('css:styleguide', function () {
	return gulp.src('styleguide/scss/*.scss')
		.pipe(sass())
		.pipe(prefix({cascade: true}))
		.pipe(gulp.dest('styleguide/dist'));
});

gulp.task('styleguide', ['styleguide-watching', 'js:styleguide', 'css:styleguide', 'connect:styleguide'], function () {
	var styles = paths.css.map(function (path) {
		return path.src + '**/*.scss';
	});
	styles.push('styleguide/scss/*.scss');
	gulp.watch(styles, ['css:styleguide']);
});


// deploy to github pages
var deploy = require('gulp-gh-pages');

gulp.task('deploy:styleguide', ['js:styleguide', 'css:styleguide'], function () {
	var options = xtend({cacheDir: 'styleguide/.tmp'}, require('./styleguide/deploy.json').options);
	return gulp.src(['styleguide/index.html', 'styleguide/dist/**/*', 'styleguide/lib/**/*'], {base: 'styleguide'})
		.pipe(deploy(options));
});
