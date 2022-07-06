---
title: Cross-Arch Reproducibility using Containers
description: Use of containers for cross architecture reproducibility using `docker` and `podman`, which I then go on to apply to JSC.
tags: ["webkit", "igalia"]
date: 2020-01-16
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
---

## Introduction

Part of my work for Igalia is on the 32bit support on MIPS (little endian) and ARM for JSC (JavaScriptCore - the JavaScript compiler in WebKit) and one of the problems we face is that of reproducibility of failures. 

We have boards to test these, namely Raspberry Pi 3 Model B+ boards, running a 32bits ARM kernel and Imagination CI20 boards running a mipsel kernel - all built with buildroot which provides images for these boards out-of-the-box. However, we don't work on these - most of us have higher performance x86_64 machines and whenever a failure occurs upstream it's generally time consuming to reproduce. 

I have therefore set out to create an environment where we can easily reproduce cross-architectural failures on JSC. I had worked on similar issues for [Racket](https://racket-lang.org), when building the cross-architectural Racket chroot environment on GitLab CI. 

## Starting with chroot

Let's start the discussion by talking about `chroot`. In any linux system you'll find a `chroot` binary. 

```shell
$ which chroot
/usr/sbin/chroot
$ chroot --help
Usage: chroot [OPTION] NEWROOT [COMMAND [ARG]...]
  or:  chroot OPTION
Run COMMAND with root directory set to NEWROOT.

  --groups=G_LIST        specify supplementary groups as g1,g2,..,gN
  --userspec=USER:GROUP  specify user and group (ID or name) to use
  --skip-chdir           do not change working directory to '/'
      --help     display this help and exit
      --version  output version information and exit

If no command is given, run '"$SHELL" -i' (default: '/bin/sh -i').

GNU coreutils online help: <https://www.gnu.org/software/coreutils/>
Full documentation at: <https://www.gnu.org/software/coreutils/chroot>
or available locally via: info '(coreutils) chroot invocation'
```

However, at a slightly lower level, [`chroot`](http://man7.org/linux/man-pages/man2/chroot.2.html) is a system call. 

```shell
$ man -s2 chroot
CHROOT(2)

NAME
       chroot - change root directory

SYNOPSIS
       #include <unistd.h>

       int chroot(const char *path);

   Feature Test Macro Requirements for glibc (see feature_test_macros(7)):
...
```

As mentioned in the man page, it changes the root of the file system for a process to the path passed as argument. This new environment created for the process is known as a chroot jail, to which we will refer simply as a *jail*.

The jail allows us to trap a process inside a filesystem, i.e. the process cannot access anything outside the filesystem it is in. So, if it tried to access the root of the filesystem, inside the jail it will  only see the root of the new file system which is the path we passed on to `chroot`. 

As an example throughout the post I will be using the factorial function. Whenever I refer to `factorial.c`, I refer to a file that you might have to create as needed and consists of the following C source code. 

```c
#include <stdio.h>
#include <stdint.h>
#include <inttypes.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {

  uint64_t result = 1;
  uint32_t arg;

  if (argc != 2)
    return 1;

  arg = strtoul(argv[1], NULL, 0);
  while(arg) result *= arg--;

  printf ("Result: %" PRIu64 "\n", result);
  return 0;
}
```

Let's compile it and run an example.

```shell
$ gcc -Wall -Wextra -o factorial factorial.c
$ ./factorial 20
Result: 2432902008176640000
```

Let's create a jail for this binary using `chroot` and run it.

```shell
$ mkdir jail
$ cp factorial jail/
$ chroot jail/ /factorial
chroot: cannot change root directory to 'jail/': Operation not permitted
```

First lesson here: only `root` can `chroot`. For security reasons, a normal user cannot `chroot`. Being able to do so, would allow the user privilege escalation ([further details](https://web.archive.org/web/20160127150916/http://www.bpfh.net/simes/computing/chroot-break.html) on breaking out of the chroot jail and privilege escalation).

So we `sudo`:

```shell
$ sudo chroot jail/ /factorial
chroot: failed to run command ‘/factorial’: No such file or directory
```

Now this really starts to annoy you and you start wondering if the path to `factorial` is correct. It is correct, the path is relative to the jail root. Once the root becomes `jail/`, the `factorial` binary is in the root of the filesystem so `/factorial` is correct. The problem is subtle but will teach you an important lesson: dependencies. This is, after all, a dynamically linked executable &#x1F4A1;. 

```shell
$ ldd factorial
        linux-vdso.so.1 (0x00007ffe1f7f9000)
        libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f65bf62e000)
        /lib64/ld-linux-x86-64.so.2 (0x00007f65bf844000)
```

Those files exist in your file system, but not in the jail, so you get an error (although a pretty terrible error message at that). Let's try a static executable instead. 

```shell
$ gcc -Wall -Wextra -static -o factorial factorial.c
$ ldd factorial
        not a dynamic executable
$ sudo chroot jail/ /factorial 20
Result: 2432902008176640000
```

This is exactly what we wanted from the beginning - to show that the binary is now jailed in this root and cannot escape without explicitly trying to, something no benign binary is likely to do (see my comment above on escaping jail). 

In chroot jails, the filesystem root changes but it's still running on the same kernel. This allows us to create a new userspace inside this jail, separate from the host's, and possibly based on a different
linux distribution. For reproducibility, you can potentially tarball this jail and send it to someone else, who could themselves `chroot` into it and reproduce a specific problem. 

## QEMU and binfmt

I will now introduce two other essential components to achieve our goal of cross architecture reproducibility: QEMU and binfmt. 

Up until now our jail has contained binaries compiled for our host architecture (in my case x86_64), however this need not be the case. [QEMU](https://www.qemu.org) is an open-source hardware emulator and virtualizer. It implements two execution modes: system mode, and user mode;

In system mode, QEMU works like [VirtualBox](https://www.virtualbox.org) it emulates a whole system - from the applications, interrupts, and kernel, all the way to the hardware devices. The one I am interested in is user mode. In user mode, QEMU emulates a single binary leaving the rest of the system untouched.

To demo how it works, lets use a cross-toolchain to compile a program to be run on a different architecture. Given I am on a `x86_64`, I will use an `armhf` toolchain. You can either download one provided from your distro or compile one with [crosstool-ng](https://crosstool-ng.github.io/).  

For the sake of reproducibility, lets compile a pre-configured one with `crosstool-ng`. Download it and install it in `$PATH` - I used version 1.24.0. Then build the cross toolchain for `armv7-rpi2-linux-gnueabihf`. 

```shell
$ mkdir build
$ cd build
build/ $ ct-ng armv7-rpi2-linux-gnueabihf
build/ $ ct-ng build
```

Let's once again compile the `factorial.c` example, but this time with our new toolchain. This toolchain will be in `$HOME/x-tools/armv7-rpi2-linux-gnueabihf` by default. 

```shell
$ export PATH=$HOME/x-tools/armv7-rpi2-linux-gnueabihf/bin:$PATH
$ armv7-rpi2-linux-gnueabihf-gcc -static -o factorial factorial.c
$ ./factorial
zsh: exec format error: ./factorial
$ file factorial
factorial: ELF 32-bit LSB executable, ARM, EABI5 version 1 (SYSV), \
dynamically linked, interpreter /lib/ld-linux-armhf.so.3, for GNU/Linux \
4.19.21, with debug_info, not stripped
```

We were expecting this error, right? After all, we cannot just execute an arm binary in a x86_64 system. However, we can if we use QEMU in user mode which is what I want to show: 

```shell
$ qemu-arm ./factorial 20 
Result: 2432902008176640000
```

Now we have it working - however, there's a last tool we need to discuss and that's `binfmt`. `binfmt_misc` is a linux kernel capability that allows arbitrary executable file formats to be recognized and passed on to an interpreter. This means that we can transparently recognize arm (or any other architecture) executables and request them to be passed to QEMU transparently when we try to execute them. 

Before proceeding, if you wish to follow the examples, verify that your kernel has `binfmt` enabled.

```shell
$ zcat /proc/config.gz| grep BINFMT
CONFIG_BINFMT_ELF=y
CONFIG_COMPAT_BINFMT_ELF=y
CONFIG_BINFMT_SCRIPT=y
CONFIG_BINFMT_MISC=y
```

If you don't have `/proc/config.gz` try instead `grep BINFMT /boot/config-$(uname -r)`.

Let's go back to our factorial on arm example, but this time install a `binfmt` record to call `qemu-arm` on the executable whenever we try to execute it directly. A `binfmt` record looks like `:name:type:offset:magic:mask:interpreter:flags` and needs to be installed by echoing the correct string to `/proc/sys/fs/binfmt_misc/register`. For details on this consult the [kernel
documentation](https://www.kernel.org/doc/html/latest/admin-guide/binfmt-misc.html). For `armv7` we can register our interpreter and run our binary transparently like this: 

```shell
$ sudo bash -c 'echo ":qemu-arm:M:0:\\x7f\\x45\\x4c\\x46\\x01\\x01\\x01\\x00\\x00\\x00\\x00\\x00\\x00\
\\x00\\x00\\x00\\x02\\x00\\x28\\x00:\\xff\\xff\\xff\\xff\\xff\\xff\\xff\\x00\\xff\\xff\\xff\\xff\\xff\
\\xff\\xff\\xff\\xfe\\xff\\xff\\xff:/home/pmatos/installs/bin/qemu-arm:OCF" > \
/proc/sys/fs/binfmt_misc/register'
$ ./factorial 20
Result: 2432902008176640000
```

The write to `/proc/sys/fs/binfmt_misc/register` may fail if you already have a record for `qemu-arm` setup. To remove the record run `echo -1 > /proc/sys/fs/binfmt_misc/qemu-arm`. Note that the file, as shown above is an ARM binary and yet we transparently run it through QEMU thanks to the `binfmt` magic we have initially set up. 

I should note, that while interesting to understand how this works behind the scenes, several people have created images to do the binfmt registration for you. One of those projects is [docker/binfmt](https://hub.docker.com/r/docker/binfmt/tags) which you can try to run using the latest tag: `docker run --rm --privileged docker/binfmt:66f9012c56a8316f9244ffd7622d7c21c1f6f28d` (another example of a similar project is
[multiarch/qemu-user-static](https://github.com/multiarch/qemu-user-static)). If, for some reason, this does not work you should know enough by now to proceed with the registration manually. 

## Creating container base images

We have gone through creating chroot jails and transparently executing cross-architecture binaries with QEMU. A base image for a container is based pretty much on what we have just learned. To create a container
base image we will create a jail with a foreign root filesystem and we will use QEMU to execute binaries inside the jail. Once all is working, we import it into docker. 

To help us create a base system, we will use `debootstrap` in two stages. We split this into two stages so we can setup QEMU in between. 

```shell
$ mkdir rootfs
$ debootstrap --foreign --no-check-gpg --arch=arm buster ./rootfs http://httpredir.debian.org/debian/
$ cp -v /usr/bin/qemu-arm-static ./rootfs/usr/bin/
$ chroot ./rootfs ./debootstrap/debootstrap --second-stage --verbose
$ mount -t devpts devpts ./rootfs/dev/pts
$ mount -t proc proc ./rootfs/proc
$ mount -t sysfs sysfs ./rootfs/sys
```

At this point our system is a debian base system with root at `./rootfs`. Note that the `qemu` you need to copy into `./rootfs/usr/bin` needs to be static in order to avoid dynamic loading issues inside the jail when it is invoked.  

Another important aspect to consider is that depending on your `binfmt` setup, you need to put the binary in the proper place inside the jail. For the above to work, your `binfmt` interpreter registration has to
point to an interpreter at `/usr/bin/qemu-arm-static`, which is the absolute path as seen from inside the jail. Now we can install all dependencies in the system at will. All commands will be using `qemu` transparently to execute if `binfmt` setup worked correctly. Remember that in the case of chroot jails (and also of containers), the kernel in use is the kernel of your host. Therefore that is the only kernel that needs to be set up with `binfmt`. You set it up outside your chroot jail and when the kernel needs to execute a foreign executable, it will look at the current `binfmt` setup for the interpreter. However, the kernel cannot access a filesystem outside the jail, so that interpreter needs to exist inside the it. 

```shell
$ chroot ./rootfs apt-get update
$ chroot ./rootfs apt-get -y upgrade
$ chroot ./rootfs apt-get install -y g++ cmake libicu-dev git ruby-highline ruby-json python
chroot ./rootfs apt-get -y autoremove
chroot ./rootfs apt-get clean
chroot ./rootfs find /var/lib/apt/lists -type f -delete
```

These are the steps to install the dependencies to build and test JSC. Let's unmount the filesystems in order to create the docker base image. 

```shell
umount ./rootfs/dev/pts
umount ./rootfs/proc
umount ./rootfs/sys
```

Let's `tar` our jail and import it into a docker image.

```shell
$ tar --numeric-owner -cvf buster-arm.tar -C ./rootfs .
$ docker import buster-arm.tar jsc-base:arm-raw
```

The image `jsc-base:arm-raw` now contains our raw system. To be able to add metadata or build on top of this image before releasing we can build a docker image that extends the raw image version. 

```shell
$ cat <<EOF > jsc32-base.Dockerfile
FROM jsc32-base:arm-raw

LABEL description="Minimal Debian image to reproduce JSC dev"
LABEL maintainer="Paulo Matos <pmatos@igalia.com>"
 
CMD ["/bin/bash"]
EOF
$ docker build -t pmatos/jsc32-base:arm -f jsc32-base.Dockerfile
$ docker push pmatos/jsc32-base:arm
```

Once we have pushed the image into the repository, we can run it from anywhere as long as `binfmt` is setup properly. 

```shell
$ docker run pmatos/jsc32-base:arm file /bin/bash
/bin/bash: ELF 32-bit LSB pie executable, ARM, EABI5 version 1 (SYSV), dynamically linked, \
interpreter /lib/ld-linux-armhf.so.3, for GNU/Linux 3.2.0, \
BuildID[sha1]=40e50d160a6c70d1a4e961200202cf853b4a2145, stripped
```

Or to get an interactive shell inside the container, use `-it`: `docker run -it pmatos/jsc32-base:arm /bin/bash`.

## Going rootless with podman

While [`docker`](https://www.docker.com) is a product of Docker Inc with various components and pricing tiers, [`podman`](https://podman.io) is a free and open source daemonless engine for developing, managing, and running containers on Linux. One of the main internal differences between `docker` and `podman` is that `podman` uses [cgroups](https://en.wikipedia.org/wiki/Cgroups) v2, which `docker` doesn't yet support. Since Fedora 31 ships with cgroups v2, for many users `podman` is the only container engine available. Fortunately, `podman` is largely `docker` compatible meaning that you can `alias docker=podman` without any issues.  

So you can do something like this.

```shell
$ podman run pmatos/jsc32-base:arm file /bin/bash
/bin/bash: ELF 32-bit LSB pie executable, ARM, EABI5 version 1 (SYSV), dynamically linked, \
interpreter /lib/ld-linux-armhf.so.3, for GNU/Linux 3.2.0, \
BuildID[sha1]=40e50d160a6c70d1a4e961200202cf853b4a2145, stripped
```

As long your `binfmt` is properly setup, it will run as well as it did with docker. 

## Application to JSC

The initial code developed for reproducible JSC32 builds can be found in the [WebKit-misc](https://github.com/pmatos/WebKit-misc/) repository and was initially pushed under commit [94bf25e](https://github.com/pmatos/WebKit-misc/commit/94bf25ebe888ae1824113eeb269fe0c0fcb5f3d4).  

The main script is in [`containers/reprojsc.sh`](https://github.com/pmatos/WebKit-misc/blob/94bf25ebe888ae1824113eeb269fe0c0fcb5f3d4/containers/reprojsc.sh) and follows the plan laid out in this blog post. 

* An image is created using [`containers/jsc32-base/build-image.sh`](https://github.com/pmatos/WebKit-misc/blob/94bf25ebe888ae1824113eeb269fe0c0fcb5f3d4/containers/jsc32-base/build-image.sh) and pushed into docker hub [pmatos/jsc32-base](https://hub.docker.com/r/pmatos/jsc32-base). This only needs to be done when the image is changed. 
* The [`containers/reprojsc.sh`](https://github.com/pmatos/WebKit-misc/blob/94bf25ebe888ae1824113eeb269fe0c0fcb5f3d4/containers/reprojsc.sh) script is run each time one wants to trigger a build and/or test of JSC. This sets up QEMU for the desired architecture, starts the image and issues the necessary commands for the actions laid out in the command line. 

To run it yourself, checkout [WebKit-misc](https://github.com/pmatos/WebKit-misc/) and [WebKit](https://webkit.org), and run `reprojsc.sh`. 

```shell
$ git clone --depth=1 git://git.webkit.org/WebKit.git
$ export WEBKIT_PATH=$PWD/WebKit
$ git clone --depth=1 git@github.com:pmatos/WebKit-misc.git
$ cd WebKit-misc/containers
$ ./reprojsc.sh -a arm -b -t -i $WEBKIT_PATH
```

This will build, test and send you into an interactive session so you can debug some possibly failed tests. Inside the container, you'll be in an ARM Cortex-A7 (32bits) environment. The other available architecture at the moment is MIPS which can be chosen with `-a mips`. 

If you have any issues or requests please open an issue in [GitHub](https://github.com/pmatos/WebKit-misc/issues). 

## What's missing?

There are many things that deserved discussion but I won't elaborate further. One of them is the difference between the container execution engine and the image builder. When using docker it's easy to think
that they are the same but it is not the case. For example, docker has a new image builder, called [`buildx`](https://docs.docker.com/buildx/working-with-buildx/) whichhas in-built support for the creation of multi-architecture images. On the other hand, `podman` is a container execution engine but an image creator is, for example, [`buildah`](https://buildah.io/), which doesn't have multi-architecture image support
[yet](https://github.com/containers/buildah/issues/1590). Don't worry if you are confused - things are moving fast in this area and it's easy to lose track of all the tools out there. 

With the ability to transparently emulate other architectures QEMU user mode will see more usage patterns. Bugs in QEMU can look like application bugs and debugging is not straightforward, so bear in this
in mind when using this technology.

## Acknowledgments

Thanks to my fellow Igalians Angelos Oikonomopoulos and Philip Chimento for providing suggestions and corrections for this blog post. 