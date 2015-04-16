/**
 * Baobab Core Unit Tests
 * =======================
 */
var assert = require('assert'),
    state = require('../state.js'),
    Baobab = require('../../src/baobab.js'),
    Cursor = require('../../src/cursor.js'),
    async = require('async'),
    _ = require('lodash');

describe('Baobab API', function() {

  describe('Basics', function() {
    var baobab = new Baobab(state);

    it('should throw an error when trying to instantiate an baobab with incorrect data.', function() {
      assert.throws(function() {
        new Baobab(undefined);
      }, /invalid data/);
    });

    it('should be possible to instantiate without the "new" keyword.', function() {
      var special = Baobab(state);

      assert(special.get('two'), baobab.get('two'));
    });
  });

  describe('Selection', function() {
    var baobab = new Baobab(state);

    it('selecting data in the baobab should return a cursor.', function() {
      assert(baobab.select(['one']) instanceof Cursor);
    });

    it('should be possible to use some polymorphism on the selection.', function() {
      var altCursor = baobab.select('one', 'subtwo', 'colors');

      assert.deepEqual(altCursor.get(), state.one.subtwo.colors);
    });

    it('should be possible to select data using a function.', function() {
      var cursor = baobab.select('one', 'subtwo', 'colors', function(v) {
        return v === 'yellow';
      });

      assert.strictEqual(cursor.get(), 'yellow');
    });

    it('should be possible to select data using a descriptor object.', function() {
      var cursor = baobab.select('items', {id: 'one'});

      assert.deepEqual(cursor.get(), {id: 'one'});
    });

    it('should be possible to select data using a cursor pointer.', function() {
      var cursor = baobab.select('one', 'subtwo', 'colors', {$cursor: ['pointer']});

      assert.strictEqual(cursor.get(), 'yellow');
    });

    it('should fail when providing a wrong path to the $cursor command.', function() {
        assert.throws(function() {
          var color = baobab.select('one', 'subtwo', 'colors', {$cursor: null});
        }, /\$cursor/);
      });
  });

  describe('Events', function() {
    var baobab = new Baobab(state);

    it('should be possible to listen to update events.', function(done) {
      baobab.on('update', function(e) {
        assert.deepEqual(e.data.log, [['one', 'subtwo', 'colors']]);
        done();
      });

      baobab.update({one: {subtwo: {colors: {$push: 'purple'}}}});
    });

    it('should only fire updates once when committing synchronously but when not in synchronous mode.', function(done) {
      var tree = new Baobab({hello: 'world'}),
          count = 0;

      tree.on('update', function() {
        count++;
      });

      tree.set('hello', 'tada').commit();

      setTimeout(function() {
        assert.strictEqual(count, 1);
        assert.strictEqual(tree.get('hello'), 'tada');
        done();
      }, 30);
    });
  });

  describe('Advanced', function() {

    it('should be possible to release a tree.', function() {
      var baobab = new Baobab(state),
          one = baobab.select('one'),
          two = baobab.select('two');

      baobab.on('update', Function.prototype);
      one.on('update', Function.prototype);
      two.on('update', Function.prototype);

      one.release();
      baobab.release();

      assert(baobab.data === undefined);
    });

    it('the tree should shift references on updates.', function() {
      var list = [1],
          baobab = new Baobab({list: list}, {asynchronous: false});

      baobab.select('list').push(2);
      assert.deepEqual(baobab.get('list'), [1, 2]);
      assert(list !== baobab.get('list'));
    });

    it('the tree should also shift parent references.', function() {
      var shiftingTree = new Baobab({root: {admin: {items: [1], other: [2]}}}, {asynchronous: false});

      var shiftingOriginal = shiftingTree.get();

      shiftingTree.select('root', 'admin', 'items').push(2);

      assert.deepEqual(shiftingTree.get('root', 'admin', 'items'), [1, 2]);

      assert(shiftingTree.get() !== shiftingOriginal);
      assert(shiftingTree.get().root !== shiftingOriginal.root);
      assert(shiftingTree.get().root.admin !== shiftingOriginal.root.admin);
      assert(shiftingTree.get().root.admin.items !== shiftingOriginal.root.admin.items);
      assert(shiftingTree.get().root.admin.other === shiftingOriginal.root.admin.other);
    });
  });

  describe('Facets', function() {
    var baobab = new Baobab(

      // Data
      {
        projects: [
          {
            id: 1,
            name: 'Tezcatlipoca',
            user: 'John'
          },
          {
            id: 2,
            name: 'Huitzilopochtli',
            user: 'John'
          },
          {
            id: 3,
            name: 'Tlaloc',
            user: 'Jack'
          }
        ],
        currentProjectId: 1
      },

      // Options
      {
        asynchronous: false,
        facets: {
          filtered: {
            cursors: {
              projects: ['projects']
            },
            get: function(data) {
              return data.projects.filter(function(p) {
                return p.user === 'John';
              });
            }
          },
          current: {
            cursors: {
              id: ['currentProjectId'],
              projects: ['projects']
            },
            get: function(data) {
              return _.find(data.projects, {id: data.id});
            }
          }
        }
      }
    );

    var filtered = baobab.facets.filtered,
        current = baobab.facets.current;

    it('should be possible to get data from facets.', function() {
      assert.deepEqual(filtered.get(), [
        {
          id: 1,
          name: 'Tezcatlipoca',
          user: 'John'
        },
        {
          id: 2,
          name: 'Huitzilopochtli',
          user: 'John'
        }
      ]);

      assert.deepEqual(current.get(), {
        id: 1,
        name: 'Tezcatlipoca',
        user: 'John'
      });

      baobab.update({
        projects: {
          $push: {
            id: 4,
            name: 'Coatlicue',
            user: 'John'
          }
        },
        currentProjectId: {
          $set: 2
        }
      });

      assert.deepEqual(filtered.get(), [
        {
          id: 1,
          name: 'Tezcatlipoca',
          user: 'John'
        },
        {
          id: 2,
          name: 'Huitzilopochtli',
          user: 'John'
        },
        {
          id: 4,
          name: 'Coatlicue',
          user: 'John'
        }
      ]);

      assert.deepEqual(current.get(), {
        id: 2,
        name: 'Huitzilopochtli',
        user: 'John'
      });
    });

    it('should be possible to listen to facets.', function() {
      var countF = 0,
          countC = 0;

      var incF = function() {countF++;},
          incC = function() {countC++;};

      filtered.on('update', incF);
      current.on('update', incC);

      baobab.select('projects').push({id: 4, name: 'Coatlicue', user: 'John'});
      baobab.set('currentProjectId', 2);

      assert.strictEqual(countF, 1);
      assert.strictEqual(countC, 2);
    });
  });

  describe('Options', function() {
    it('should be possible to commit changes immediately.', function() {
      var baobab = new Baobab({hello: 'world'}, {asynchronous: false});
      baobab.set('hello', 'you');
      assert.strictEqual(baobab.get('hello'), 'you');
    });

    it('should be possible to let the user commit himself.', function(done) {
      var baobab = new Baobab({number: 1}, {autoCommit: false});
      baobab.set('number', 2);

      setTimeout(function() {
        assert.strictEqual(baobab.get('number'), 1);
        baobab.commit();
        setTimeout(function() {
          assert.strictEqual(baobab.get('number'), 2);
          done();
        }, 0);
      }, 0);
    });

    it('should be possible to validate the tree and rollback on fail.', function() {
      var invalidCount = 0;

      function v(state, nextState, paths) {
        assert(this === baobab);

        if (typeof nextState.hello !== 'string')
          return new Error('Invalid tree!');
      }

      var baobab = new Baobab({hello: 'world'}, {validate: v, asynchronous: false});

      baobab.on('invalid', function(e) {
        var error = e.data.error;

        assert.strictEqual(error.message, 'Invalid tree!');
        invalidCount++;
      });

      baobab.set('hello', 'John');

      assert.strictEqual(invalidCount, 0);
      assert.strictEqual(baobab.get('hello'), 'John');

      baobab.set('hello', 4);

      assert.strictEqual(invalidCount, 1);
      assert.strictEqual(baobab.get('hello'), 'John');
    });

    it('should be possible to validate the tree and let the tree update on fail.', function() {
      var invalidCount = 0;

      function v(state, nextState, paths) {
        assert(this === baobab);

        if (typeof nextState.hello !== 'string')
          return new Error('Invalid tree!');
      }

      var baobab = new Baobab({hello: 'world'}, {validate: v, asynchronous: false, validationBehavior: 'notify'});

      baobab.on('invalid', function(e) {
        var error = e.data.error;

        assert.strictEqual(error.message, 'Invalid tree!');
        invalidCount++;
      });

      baobab.set('hello', 'John');

      assert.strictEqual(invalidCount, 0);
      assert.strictEqual(baobab.get('hello'), 'John');

      baobab.set('hello', 4);

      assert.strictEqual(invalidCount, 1);
      assert.strictEqual(baobab.get('hello'), 4);
    });
  });
});
