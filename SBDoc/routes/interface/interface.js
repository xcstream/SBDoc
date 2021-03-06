/**
 * Created by sunxin on 2016/11/20.
 */
var async=require("asyncawait/async")
var await=require("asyncawait/await")
var e=require("../../util/error.json");
var util=require("../../util/util");
var con=require("../../../config.json");
var user=require("../../model/userModel")
var project=require("../../model/projectModel")
var group=require("../../model/groupModel")
var interface=require("../../model/interfaceModel")
var fs=require("fs");
let refreshInterface=async (function (id) {
    let query={
        project:id
    }
    let arr=await (group.findAsync(query,"_id name type",{
        sort:"name"
    }));
    for(let obj of arr)
    {
        let arrInterface=await (interface.findAsync({
            group:obj._id
        },"_id name method",{
            sort:"name"
        }));
        obj._doc.data=arrInterface;
    }
    return arr;
})

var validateUser =async (function validateUser(req) {
    let obj,pro;
    if(req.clientParam.id)
    {
        let obj=await (interface.findOneAsync({
            _id:req.clientParam.id
        }));
        if(!obj)
        {
            util.throw(e.interfaceNotFound,"接口不存在");
        }
        req.interface=obj;
        pro=obj.project;
    }
    else
    {
        pro=req.clientParam.project;
    }
    obj=await (project.findOneAsync({
        _id:pro,
        $or:[
            {
                owner:req.userInfo._id
            },
            {
                "users.user":req.userInfo._id
            }
        ]
    }))
    if(!obj)
    {
        util.throw(e.projectNotFound,"项目不存在");
    }
    else
    {
        req.obj=obj;
        if(obj.owner.toString()==req.userInfo._id.toString())
        {
            req.access=1;
        }
        else
        {
            for(let o of obj.users)
            {
                if(o.user.toString()==req.userInfo._id.toString())
                {
                    if(o.role==0)
                    {
                        req.access=1;
                    }
                    else
                    {
                        req.access=0;
                    }
                    break;
                }
            }
        }
    }
    if(req.clientParam.group)
    {
        let g=await (group.findOneAsync({
            _id:req.clientParam.group
        }));
        if(!g)
        {
            util.throw(e.groupNotFound,"分组不存在")
        }
        else
        {
            req.group=g;
        }
    }
})

function create(req,res) {
    try
    {
        await (validateUser(req));
        if(req.access==0)
        {
            util.throw(e.userForbidden,"没有权限");

        }
        let update={

        };
        for(let key in req.clientParam)
        {
            if(key!="id" && req.clientParam[key]!==undefined)
            {
                if(key=="queryParam" || key=="header" || key=="bodyParam" || key=="outParam" || key=="restParam" || key=="bodyInfo" || key=="outInfo")
                {
                    update[key]=JSON.parse(req.clientParam[key]);
                }
                else
                {
                    update[key]=req.clientParam[key];
                }

            }
        }
        if(req.clientParam.id)
        {
            if(update.method=="GET" || update.method=="DELETE")
            {
                update["$unset"]={
                    bodyInfo:1
                };
                update.bodyParam=[];
            }
            update.editor=req.userInfo._id;
            let obj=await (interface.findOneAndUpdateAsync({
                _id:req.clientParam.id
            },update,{
                new:false
            }));
            if(req.clientParam.group)
            {
                if(obj.group.toString()!=req.clientParam.group)
                {
                    let arr=await (refreshInterface(req.obj._id.toString()))
                    util.ok(res,arr,"修改成功");
                    return;
                }
            }
            util.ok(res,obj._id,"修改成功");
        }
        else
        {
            if(update.method=="GET" || update.method=="DELETE")
            {
                if(update.bodyInfo)
                {
                    delete update.bodyInfo;
                }
                update.bodyParam=[];
            }
            update.owner=req.userInfo._id;
            update.editor=req.userInfo._id;
            let obj=await (interface.createAsync(update))
            util.ok(res,obj,"新建成功");
        }
    }
    catch (err)
    {
        util.catch(res,err);
    }
}

function remove(req,res) {
    try
    {
        await (validateUser(req));
        if(req.access==0)
        {
            util.throw(e.userForbidden,"没有权限");

        }
        let obj=await (group.findOneAsync({
            project:req.obj._id,
            type:1
        }))
        req.interface.group=obj._id;
        await (req.interface.saveAsync())
        let arr=await (refreshInterface(req.obj._id));
        util.ok(res,arr,"已移到回收站");
    }
    catch (err)
    {
        util.catch(res,err);
    }
}

function move(req,res) {
    try
    {
        await (validateUser(req));
        if(req.access==0)
        {
            util.throw(e.userForbidden,"没有权限");

        }
        let update={};
        update.group=req.group._id;
        await (interface.updateAsync({
            _id:req.clientParam.id
        },update))
        util.ok(res,"移动成功");
    }
    catch (err)
    {
        util.catch(res,err);
    }
}

function info(req,res) {
    try
    {
        await (validateUser(req));
        let obj=await (interface.populateAsync(req.interface,{
            path:"project",
            select:"name"
        }))
        if(obj.group)
        {
            obj=await (interface.populateAsync(obj,{
                path:"group",
                select:"name"
            }))
        }
        if(obj.owner)
        {
            obj=await (interface.populateAsync(obj,{
                path:"owner",
                select:"name"
            }))
        }
        if(obj.editor)
        {
            obj=await (interface.populateAsync(obj,{
                path:"editor",
                select:"name"
            }))
        }
        if(obj.group._id.toString()!=req.clientParam.group)
        {
            obj._doc.change=1;
        }
        if(req.clientParam.run)
        {
            obj._doc.baseUrl=req.obj.baseUrls;
        }
        util.ok(res,obj,"ok");
    }
    catch (err)
    {
        util.catch(res,err);
    }
}

function destroy(req,res) {
    try
    {
        await (validateUser(req));
        if(req.access==0)
        {
            util.throw(e.userForbidden,"没有权限");

        }
        await (interface.removeAsync({
            _id:req.clientParam.id
        }))
        let arr=await (refreshInterface(req.obj._id));
        util.ok(res,arr,"删除成功");
    }
    catch (err)
    {
        util.catch(res,err);
    }
}

exports.create=async (create);
exports.remove=async (remove);
exports.move=async (move);
exports.info=async (info);
exports.destroy=async (destroy);












