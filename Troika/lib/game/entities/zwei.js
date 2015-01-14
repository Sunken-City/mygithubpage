ig.module(
        'game.entities.zwei'
    )
    .requires(
        'impact.entity'
    )
    .defines(function(){
        EntityZwei = ig.Entity.extend({
            animSheet: new ig.AnimationSheet( 'media/zwei.png', 60, 90 ),
            size: {x: 60, y:86},
            offset: {x: 0, y:-6},

            flip: false,
            maxVel: {x: 600, y: 800},
            friction: {x: 300, y: 0},
            zIndex: -999,

            type: ig.Entity.TYPE.A,
            checkAgainst: ig.Entity.TYPE.A,
            collides: ig.Entity.COLLIDES.NEVER,
            gravityFactor: 0,


            init: function( x, y, settings ) {
                this.parent( x, y, settings );




                this.addAnim( 'idle', .5, [0]);
                this.addAnim( 'standing', .5, [1]);

            },

            inProximity: function(player)
            {
                return( (( this.pos.x + 200) > player.pos.x ) && (( this.pos.x - 200) < player.pos.x ));
            },

            inCloseProximity: function(player)
            {
                return( (( this.pos.x + 50) > player.pos.x ) && (( this.pos.x - 50) < player.pos.x ));
            },


            update: function() {



                var player = ig.game.getEntitiesByType( EntityPlayer )[0];
                if (this.inProximity(player))
                {

                    this.currentAnim = this.anims.standing;

                }
                if (this.inCloseProximity(player))
                {
                      ig.input.unbindAll();

                    if( !ig.global.wm )
                    { // Not in WM?

                        if (!ig.game.getEntitiesByType( EntityZweiDialog )[0])
                        {
                            ig.game.spawnEntity(EntityZweiDialog, this.pos.x,  this.pos.y + 200);
                        }

                    }


                }





                this.parent();
            }

        });
    });





