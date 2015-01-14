
ig.module(
        'game.background'
    ).requires(
        'impact.entity'

    ).defines(function(){

        EntityBackground = ig.Class.extend({

            init: function(){

                ig.Game.inject({

                    background : null,


                    variablesBeenSet : false,

                    init: function(){},

                    update: function () {

                        if ( this.variablesBeenSet == false)
                        {
                            // Create BackgroundMap
                            var data = [
                                [1,1,1],
                                [1,1,1],
                                [1,1,1]
                            ];

                            this.background = new ig.BackgroundMap(600, data, 'media/background.png');

                            this.forestBackground = new ig.BackgroundMap(600, data, 'media/treeBackground.png');
                            this.forestBackground.repeat = true;

                            this.forestBackground2 = new ig.BackgroundMap(600, data, 'media/treeBackground2.png');
                            this.forestBackground2.repeat = true;
                            this.forestBackground2.scroll.y = 40;

                            this._mapWidth = ig.game.backgroundMaps[0].width * ig.game.backgroundMaps[0].tilesize - (ig.system.width);
                            this._mapHeight = ig.game.backgroundMaps[0].height * ig.game.backgroundMaps[0].tilesize - (ig.system.height);

                            this.variablesBeenSet = true;
                        }


                        var player = ig.game.getEntitiesByType( EntityPlayer )[0];
                        if( player ) {


                            //*********
                            // prevent background from scrolling if close to a map edge

                            var x = player.pos.x - (ig.system.width / 2);
                            if (  x > 0 && x < this._mapWidth )
                            {
                                this.forestBackground.scroll.x += (player.vel.x / 100);
                                this.forestBackground2.scroll.x += (player.vel.x / 150);
                            }

                            this.parent();

                        }

                        //*********************************************


                    },//end of update function

                    draw: function() {

                        this.background.draw();
                        this.forestBackground2.draw();
                        this.forestBackground.draw();

                        this.parent();

                    }

                })//end of inject function

            } //end of init fuction

        });
    });

