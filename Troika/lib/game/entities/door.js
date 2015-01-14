/**
 * Created by anthony on 12/13/13.
 */


ig.module(
        'game.entities.door'
    )
    .requires(
        'impact.entity'
    )
    .defines(function(){
        EntityDoor = ig.Entity.extend({
            animSheet: new ig.AnimationSheet( 'media/door.png', 30, 120 ),
            size: {x: 30, y:120},
            offset: {x: 0, y:0},

            flip: false,
            maxVel: {x: 600, y: 800},
            friction: {x: 300, y: 0},

            type: ig.Entity.TYPE.A,
            checkAgainst: ig.Entity.TYPE.A,
            collides: ig.Entity.COLLIDES.NEVER,
            gravityFactor: 0,


            init: function( x, y, settings ) {
                this.parent( x, y, settings );

                // Add the animations
                this.addAnim( 'on', .5, [1]);
                this.addAnim( 'off', .5, [0]);

            },

            hasPassed: function(player)
            {
                return((this.pos.x + 15) < player.pos.x );
            },

            update: function() {
                var player = ig.game.getEntitiesByType( EntityPlayer )[0];
                if (this.hasPassed(player))
                {
                    this.currentAnim = this.anims.on;
                    this.collides = ig.Entity.COLLIDES.FIXED;

                }
                else
                {
                    this.currentAnim = this.anims.off;
                    this.collides = ig.Entity.COLLIDES.NEVER;
                }

                this.parent();
            }

        });
    });





