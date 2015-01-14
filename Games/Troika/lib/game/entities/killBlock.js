/**
 * Created by anthony on 12/13/13.
 */


ig.module(
        'game.entities.killBlock'
    )
    .requires(
        'impact.entity'
    )
    .defines(function(){
        EntityKillBlock = ig.Entity.extend({
            animSheet: new ig.AnimationSheet( 'media/troika.png', 30, 30 ),
            size: {x: 30, y:30},
            offset: {x: 0, y:0},

            flip: false,
            maxVel: {x: 600, y: 800},
            friction: {x: 300, y: 0},

            type: ig.Entity.TYPE.A,
            checkAgainst: ig.Entity.TYPE.A,
            collides: ig.Entity.COLLIDES.FIXED,
            gravityFactor: 0,


            init: function( x, y, settings ) {
                this.parent( x, y, settings );

                // Add the animations
                this.addAnim( 'idle', 1, [43]);

            },

            collideWith: function ( other, axis ) {

                if (!(other instanceof EntityKillBlock))
                {
                    other.receiveDamage( 10, this );
                }

            },

            update: function() {

                this.parent();
            }

        });
    });





